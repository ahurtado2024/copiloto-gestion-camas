/* ------------------------------------------------------------------ */
/*  PUNTO ÚNICO DE MUTACIÓN — POST /api/ops                            */
/*  Toda escritura del sistema pasa por aquí.                          */
/*  El actor se resuelve en este orden de prioridad:                   */
/*  1. Usuario autenticado de la sesión (fuente de verdad)             */
/*  2. Parámetro explícito (solo para bots/Telegram con token)         */
/*  3. Fallback: TURNO_ACTOR del settings (nunca en producción real)   */
/* ------------------------------------------------------------------ */

import { NextResponse } from "next/server";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/rbac";
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
import { toDegradedResponse } from "@/lib/errors";
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
        { ok: false, message: "Falta el campo \"op\".", tone: "error", code: "VALIDATION_ERROR" },
        { status: 200 }
      );
    }

    // ----------------------------------------------------------------
    // RESOLUCIÓN DEL ACTOR (R6 — todo queda registrado con actor real)
    // ----------------------------------------------------------------
    const session = await auth();
    const sessionUser = session?.user as { name?: string; role?: string } | undefined;
    const rules = await getRules();
    const userRole = sessionUser?.role ?? "viewer";

    // El actor real es el nombre del usuario autenticado.
    // Si el request viene de Telegram/bot sin sesión, usamos el fallback de settings.
    const ACTOR = sessionUser?.name ?? rules.TURNO_ACTOR;

    const deny = (message: string): NextResponse<OpResult> =>
      NextResponse.json({ ok: false, message, tone: "error" });

    let r: OpResult;

    switch (body.op) {
      // ── Aprobaciones ─────────────────────────────────────────────
      case "decide_approval": {
        if (!hasPermission(userRole, "approvals:decide"))
          return deny("Tu rol no tiene permiso para decidir aprobaciones.");
        const v = validateDecideApproval(p, ACTOR);
        r = await decideApproval(v);
        break;
      }

      // ── Tareas de limpieza ────────────────────────────────────────
      case "task": {
        if (!hasPermission(userRole, "tasks:update"))
          return deny("Tu rol no tiene permiso para actualizar tareas de limpieza.");
        // Las tareas las ejecuta aseo — el actor puede ser distinto al de la sesión
        const taskActor = sessionUser?.name ?? (rules.CANAL_ASEO === "telegram" ? "Cuadrilla aseo" : ACTOR);
        const v = validateTaskAction(p, taskActor);
        r = await taskAction(v);
        break;
      }

      // ── Acciones sobre camas ──────────────────────────────────────
      case "bed": {
        if (!hasPermission(userRole, "beds:mutate"))
          return deny("Tu rol no tiene permiso para modificar camas.");
        const v = validateBedAction(p, ACTOR);
        r = await bedAction(v);
        break;
      }

      // ── Conflictos ────────────────────────────────────────────────
      case "resolve_conflict": {
        if (!hasPermission(userRole, "conflicts:resolve"))
          return deny("Tu rol no tiene permiso para resolver conflictos.");
        const v = validateResolveConflict(p, ACTOR);
        r = await resolveConflict(v);
        break;
      }

      // ── Borradores de correo ──────────────────────────────────────
      case "draft_reply": {
        if (!hasPermission(userRole, "mail:draft"))
          return deny("Tu rol no tiene permiso para preparar borradores.");
        const v = validateDraftReply(p, ACTOR);
        r = await draftReply(v);
        break;
      }

      // ── Configuración ─────────────────────────────────────────────
      case "save_setting": {
        if (!hasPermission(userRole, "settings:edit"))
          return deny("Tu rol no tiene permiso para editar ajustes.");
        const v = validateSaveSetting(p, ACTOR);
        const check = validateSetting(v.key, v.value);
        if (!check.ok) {
          r = fail(check.message ?? "Valor inválido.");
        } else {
          await setSetting(v.key, check.value!);
          await logEvent({
            actor: ACTOR,
            source: "panel",
            kind: "config_actualizada",
            summary: `${ACTOR} actualizó la configuración "${v.key}" → ${check.value}.`,
          });
          r = ok(`Configuración guardada: ${v.key} = ${check.value}. El motor la aplica desde ya.`);
        }
        break;
      }

      // ── Contactos de agenda ───────────────────────────────────────
      case "save_contact": {
        if (!hasPermission(userRole, "agenda:edit"))
          return deny("Tu rol no tiene permiso para editar la agenda.");
        const id       = Number(p.id);
        const priority = Number(p.priority);
        await db.update(contacts).set({ isPriority: priority }).where(eq(contacts.id, id));
        await logEvent({
          actor: ACTOR,
          source: "panel",
          kind: "config_actualizada",
          summary: `${ACTOR} ${priority === 1 ? "marcó como prioritario" : "quitó prioridad de"} el contacto #${id}.`,
        });
        r = ok(priority === 1 ? "Contacto marcado como prioritario." : "Prioridad removida.");
        break;
      }

      // ── Cierre de turno ───────────────────────────────────────────
      case "close_shift": {
        if (!hasPermission(userRole, "turno:view"))
          return deny("Tu rol no tiene permiso para cerrar turno.");
        r = await closeShift(ACTOR);
        break;
      }

      // ── Consulta de capacidad ─────────────────────────────────────
      case "capacity_query":
        r = await capacityAnswer(ACTOR);
        break;

      // ── Utilidades del sistema (solo admin / encargada) ───────────
      case "simulate_inbound": {
        if (!hasPermission(userRole, "settings:edit"))
          return deny("Solo encargada o admin puede usar herramientas del sistema.");
        r = await simulateInbound();
        break;
      }
      case "simulate_retry": {
        if (!hasPermission(userRole, "settings:edit"))
          return deny("Solo encargada o admin puede usar herramientas del sistema.");
        r = await simulateRetry();
        break;
      }
      case "reset_demo": {
        if (!hasPermission(userRole, "settings:edit"))
          return deny("Solo encargada o admin puede reiniciar la demo.");
        try {
          await execAsync("npx tsx scripts/seed.ts", { cwd: process.cwd(), timeout: 90_000 });
          r = ok("Demo reiniciada correctamente.");
        } catch (e) {
          r = fail(`No se pudo reiniciar la demo: ${e instanceof Error ? e.message.slice(0, 80) : "error"}. (R11 — la hoja sigue activa).`);
        }
        break;
      }

      // ── Ping / mantenimiento ──────────────────────────────────────
      case "ping":
        await ensureMaintenance();
        r = { ok: true, message: "Sistema operativo", tone: "ok" };
        break;

      default:
        r = fail(`Operación desconocida: "${body.op}". Revisa docs/API-REFERENCE.md.`);
    }

    return NextResponse.json(r);
  } catch (e) {
    // R11: nunca dejar al humano sin salida
    const degraded = toDegradedResponse(e);
    return NextResponse.json(degraded, { status: 200 });
  }
}
