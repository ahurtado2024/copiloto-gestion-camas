import { NextResponse } from "next/server";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  bedAction,
  decideApproval,
  taskAction,
  resolveConflict,
  capacityAnswer,
  closeShift,
  ensureMaintenance,
  draftReply,
  logEvent,
  type OpResult,
  ok,
  fail,
} from "@/lib/engine";
import { simulateInbound, simulateRetry } from "@/lib/inbox";
import { getRules, setSetting, validateSetting } from "@/lib/config";
import { toDegradedResponse, OperationalError } from "@/lib/errors";
import {
  validateDecideApproval,
  validateTaskAction,
  validateBedAction,
  validateResolveConflict,
  validateDraftReply,
  validateSaveSetting,
} from "@/lib/validate";

export const dynamic = "force-dynamic";

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { op: string; params?: Record<string, unknown> };
    const p = body.params ?? {};

    if (!body.op || typeof body.op !== "string") {
      return NextResponse.json(
        { ok: false, message: "Falta el campo \"op\" con la operación a ejecutar.", tone: "error", code: "VALIDATION_ERROR" },
        { status: 200 }
      );
    }

    const rules = await getRules();
    const ACTOR = rules.TURNO_ACTOR;

    let r: OpResult;

    switch (body.op) {
      case "decide_approval": {
        const v = validateDecideApproval(p, ACTOR);
        r = await decideApproval(v);
        break;
      }
      case "task": {
        const v = validateTaskAction(p, rules.CANAL_ASEO === "telegram" ? "Cuadrilla aseo" : ACTOR);
        r = await taskAction(v);
        break;
      }
      case "bed": {
        const v = validateBedAction(p, ACTOR);
        r = await bedAction(v);
        break;
      }
      case "resolve_conflict": {
        const v = validateResolveConflict(p, ACTOR);
        r = await resolveConflict(v);
        break;
      }
      case "draft_reply": {
        const v = validateDraftReply(p, ACTOR);
        r = await draftReply(v);
        break;
      }
      case "save_setting": {
        const v = validateSaveSetting(p, ACTOR);
        const check = validateSetting(v.key, v.value);
        if (!check.ok) {
          r = fail(check.message ?? "Valor inválido.");
        } else {
          await setSetting(v.key, check.value!);
          await logEvent({
            actor: v.actor,
            source: "panel",
            kind: "config_actualizada",
            summary: `${v.actor} actualizó la configuración "${v.key}" → ${check.value}. El motor la aplica desde este instante.`,
          });
          r = ok(`Configuración guardada: ${v.key} = ${check.value}. El motor la aplica desde ya — quedó en la caja negra.`);
        }
        break;
      }
      case "reset_demo": {
        try {
          await execAsync("npx tsx scripts/seed.ts", { cwd: process.cwd(), timeout: 90_000 });
          r = ok("Demo reiniciada: red, camas, ciclos, mensajes y configuración vuelven a su estado inicial ficticio.");
        } catch (e) {
          r = fail(`No se pudo reiniciar la demo (${e instanceof Error ? e.message.slice(0, 120) : "error"}). La hoja del turno nunca depende del sistema (R11).`);
        }
        break;
      }
      case "simulate_inbound":
        r = await simulateInbound();
        break;
      case "simulate_retry":
        r = await simulateRetry();
        break;
      case "capacity_query":
        r = await capacityAnswer(ACTOR);
        break;
      case "close_shift":
        r = await closeShift(ACTOR);
        break;
      case "save_contact": {
        const id = Number(p.id);
        const priority = Number(p.priority);
        await db.update(contacts).set({ isPriority: priority }).where(eq(contacts.id, id));
        r = ok(priority === 1 ? "Contacto marcado como prioritario." : "Prioridad removida del contacto.");
        break;
      }
      case "ping":
        await ensureMaintenance();
        r = { ok: true, message: "Sistema operativo", tone: "ok" };
        break;
      default:
        r = fail(`Operación desconocida: "${body.op}". Revisa la documentación en docs/API-REFERENCE.md.`);
    }

    return NextResponse.json(r);
  } catch (e) {
    // R11: nunca dejar al humano sin salida
    const degraded = toDegradedResponse(e);
    return NextResponse.json(degraded, { status: 200 });
  }
}
