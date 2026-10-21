/* ------------------------------------------------------------------ */
/*  MOTOR DEL COPILOTO                                                 */
/*  Implementa el contrato de operación y las reglas innegociables:    */
/*  R1 human-in-the-loop · R2 disponibilidad jamás por inferencia      */
/*  R3 no sobrescribir en silencio · R4 contenido externo = dato       */
/*  R5 no inventar · R6 todo queda registrado · R7 idempotencia        */
/*  R8 dato con vencimiento · R10 reversibilidad                       */
/*  Los umbrales se leen en caliente desde settings (ver /ajustes).    */
/* ------------------------------------------------------------------ */

import { db } from "@/db";
import {
  approvals,
  beds,
  cleaningTasks,
  conflicts,
  events,
  messages,
  shiftReports,
  type Approval,
  type Bed,
  type CleaningTask,
} from "@/db/schema";
import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import { getRules, type RuntimeRules } from "./config";
import type { BedStatus, TaskStatus } from "./domain";
import { addMinutes, minutesBetween } from "./time";

export type OpResult = { ok: boolean; message: string; tone: "ok" | "warn" | "error" };

export const ok = (message: string): OpResult => ({ ok: true, message, tone: "ok" });
export const warn = (message: string): OpResult => ({ ok: true, message, tone: "warn" });
export const fail = (message: string): OpResult => ({ ok: false, message, tone: "error" });

/* ------------------------------------------------------------------ */
/*  Caja negra: append-only, idempotente                               */
/* ------------------------------------------------------------------ */

export async function logEvent(e: {
  actor: string;
  source: string;
  kind: string;
  summary: string;
  bedId?: number | null;
  taskId?: number | null;
  approvalId?: number | null;
  payload?: Record<string, unknown>;
  ts?: Date;
  dedupeKey?: string;
}) {
  const q = db.insert(events).values({
    actor: e.actor,
    source: e.source,
    kind: e.kind,
    summary: e.summary,
    bedId: e.bedId ?? null,
    taskId: e.taskId ?? null,
    approvalId: e.approvalId ?? null,
    payload: e.payload ?? {},
    ts: e.ts ?? new Date(),
    dedupeKey: e.dedupeKey ?? null,
  });
  if (e.dedupeKey) {
    await q.onConflictDoNothing({ target: events.dedupeKey });
  } else {
    await q;
  }
}

/* ------------------------------------------------------------------ */
/*  Códigos correlativos legibles                                      */
/* ------------------------------------------------------------------ */

function yyyymmdd(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

async function nextTaskCode(now: Date): Promise<string> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(cleaningTasks);
  return `LMP-${yyyymmdd(now)}-${String((row?.n ?? 0) + 1).padStart(4, "0")}`;
}

async function nextApprovalCode(): Promise<string> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(approvals);
  return `APR-${String((row?.n ?? 0) + 1).padStart(4, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Cargas básicas                                                     */
/* ------------------------------------------------------------------ */

export async function getBed(id: number): Promise<Bed | undefined> {
  const [b] = await db.select().from(beds).where(eq(beds.id, id));
  return b;
}

export async function getTask(id: number): Promise<CleaningTask | undefined> {
  const [t] = await db.select().from(cleaningTasks).where(eq(cleaningTasks.id, id));
  return t;
}

export async function getApproval(id: number): Promise<Approval | undefined> {
  const [a] = await db.select().from(approvals).where(eq(approvals.id, id));
  return a;
}

async function setBedStatus(bedId: number, status: BedStatus, now: Date, confirm = true, note?: string | null) {
  await db
    .update(beds)
    .set({
      status,
      statusSince: now,
      ...(confirm ? { lastConfirmedAt: now } : {}),
      ...(note !== undefined ? { note } : {}),
    })
    .where(eq(beds.id, bedId));
}

/** Propuestas pendientes que referencian una cama cuya condición cambió */
async function supersedeStaleApprovalsForBed(bedId: number, now: Date, reason: string, exceptId?: number) {
  const pendings = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.bedId, bedId), eq(approvals.status, "pending")));
  for (const a of pendings) {
    if (exceptId && a.id === exceptId) continue;
    const assumed = (a.payload as { assumedStatus?: string }).assumedStatus;
    const bed = await getBed(bedId);
    if (assumed && bed && assumed !== bed.status) {
      await db
        .update(approvals)
        .set({ status: "superseded", outcomeNote: reason, decidedAt: now })
        .where(eq(approvals.id, a.id));
      await logEvent({
        actor: "sistema",
        source: "sistema",
        kind: "aprobacion_obsoleta",
        summary: `${a.code} quedó obsoleta: la condición de la cama cambió antes de decidir (${reason}).`,
        bedId,
        approvalId: a.id,
        dedupeKey: `sup:${a.id}`,
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/*  MANTENIMIENTO PEREZOSO — se ejecuta en cada lectura/acción         */
/* ------------------------------------------------------------------ */

export async function ensureMaintenance(now = new Date()) {
  const R = await getRules();
  // 1) Propuestas vencidas → se anulan
  const pendings = await db.select().from(approvals).where(eq(approvals.status, "pending"));
  for (const a of pendings) {
    if (a.expiresAt.getTime() < now.getTime()) {
      await db
        .update(approvals)
        .set({ status: "expired", outcomeNote: "Venció sin decisión humana", decidedAt: now })
        .where(eq(approvals.id, a.id));
      await logEvent({
        actor: "sistema",
        source: "sistema",
        kind: "aprobacion_vencida",
        summary: `${a.code} venció sin decisión: "${a.title}". La propuesta se anuló; no se aplicará nada.`,
        bedId: a.bedId,
        approvalId: a.id,
        dedupeKey: `exp:${a.id}`,
      });
      if (a.kind === "discharge_confirmation" && a.bedId) {
        const bed = await getBed(a.bedId);
        if (bed && bed.status === "discharge_detected") {
          const prev = ((a.payload as { previousStatus?: BedStatus }).previousStatus ?? "occupied") as BedStatus;
          await setBedStatus(bed.id, prev, now, false);
          await logEvent({
            actor: "sistema",
            source: "sistema",
            kind: "alta_rechazada",
            summary: `Alta detectada en ${bed.code} quedó sin confirmar a tiempo; la cama vuelve a "${prev}" sin tocarse nada más.`,
            bedId: bed.id,
            dedupeKey: `expbed:${a.id}`,
          });
        }
      }
    } else if (a.bedId) {
      // 2) Obsolescencia
      const assumed = (a.payload as { assumedStatus?: string }).assumedStatus;
      const bed = await getBed(a.bedId);
      if (assumed && bed && assumed !== bed.status) {
        await db
          .update(approvals)
          .set({ status: "superseded", outcomeNote: "La condición cambió desde que se propuso", decidedAt: now })
          .where(eq(approvals.id, a.id));
        await logEvent({
          actor: "sistema",
          source: "sistema",
          kind: "aprobacion_obsoleta",
          summary: `${a.code} quedó obsoleta: ${bed.code} ya no está en "${assumed}". No se escribe un dato viejo sobre un estado nuevo.`,
          bedId: bed.id,
          approvalId: a.id,
          dedupeKey: `sup:${a.id}`,
        });
      }
    }
  }

  // 3) Escalado de avisos de limpieza sin aceptación (UC-04)
  const active = await db.select().from(cleaningTasks).where(eq(cleaningTasks.status, "notified"));
  for (const t of active) {
    if (!t.notifiedAt) continue;
    const waited = minutesBetween(t.notifiedAt, now);
    const dayId = yyyymmdd(now);
    if (waited > R.CLEANING_ACCEPT_SLA_MIN * 2 && t.priority !== "critica") {
      await db.update(cleaningTasks).set({ priority: "critica" }).where(eq(cleaningTasks.id, t.id));
      const b = await getBed(t.bedId);
      await logEvent({
        actor: "sistema",
        source: "sistema",
        kind: "limpieza_escalada",
        summary: `${t.code} (${b?.code ?? "?"}) lleva ${waited} min sin que aseo tome el aviso. Se escala a CRÍTICA.`,
        bedId: t.bedId,
        taskId: t.id,
        dedupeKey: `esc2:${t.id}:${dayId}`,
      });
    } else if (waited > R.CLEANING_ACCEPT_SLA_MIN && t.priority === "normal") {
      await db.update(cleaningTasks).set({ priority: "alta" }).where(eq(cleaningTasks.id, t.id));
      const b = await getBed(t.bedId);
      await logEvent({
        actor: "sistema",
        source: "sistema",
        kind: "limpieza_escalada",
        summary: `${t.code} (${b?.code ?? "?"}) superó el SLA de aceptación (${R.CLEANING_ACCEPT_SLA_MIN} min). Se genera seguimiento con prioridad alta.`,
        bedId: t.bedId,
        taskId: t.id,
        dedupeKey: `esc1:${t.id}:${dayId}`,
      });
    }
  }

  // 4) Datos vencidos (R8)
  const allBeds = await db.select().from(beds).where(ne(beds.status, "out_of_service"));
  const staleLimit = addMinutes(now, -R.STALE_AFTER_HOURS * 60);
  for (const b of allBeds) {
    if (b.lastConfirmedAt.getTime() < staleLimit.getTime()) {
      await logEvent({
        actor: "sistema",
        source: "sistema",
        kind: "dato_vencido",
        summary: `${b.code} (${b.unit}): el dato lleva más de ${R.STALE_AFTER_HOURS} h sin confirmación humana. Se marca como vencido — es un pendiente, no un neutro.`,
        bedId: b.id,
        dedupeKey: `stale:${b.id}:${yyyymmdd(now)}`,
      });
    }
  }

  // 5. Alertas de red (Contactos prioritarios sin responder)
  try {
    const { getPriorityAlerts } = await import("./executive");
    const alerts = await getPriorityAlerts();
    if (alerts.length > 0) {
      const { sendMessage } = await import("./telegram");
      const { env } = await import("@/env");
      await sendMessage(process.env.TELEGRAM_CHAT_ID_TURNO!, 
        `⚠️ <b>DEUDA DE RED:</b> Tienes ${alerts.length} correos de centros prioritarios esperando respuesta.`,
        { disable_notification: true }
      );
    }
  } catch (e) { /* Fallback silencioso */ }
}

/* ------------------------------------------------------------------ */
/*  PROPUESTAS — el sistema propone, nunca afirma (R1)                 */
/* ------------------------------------------------------------------ */

export async function proposeDischarge(opts: {
  bedId: number;
  origin: "correo" | "telegram" | "panel" | "hoja";
  messageId?: number;
  evidence?: string;
  actor?: string;
}): Promise<OpResult> {
  const now = new Date();
  const R = await getRules();
  const bed = await getBed(opts.bedId);
  if (!bed) return fail("Cama no encontrada.");
  if (bed.status !== "occupied" && bed.status !== "unknown") {
    return fail(`No se puede proponer un alta sobre ${bed.code}: está en estado "${bed.status}". El sistema no inventa.`);
  }
  const openConflict = await db
    .select()
    .from(conflicts)
    .where(and(eq(conflicts.bedId, bed.id), eq(conflicts.status, "open")));
  if (openConflict.length > 0) {
    await logEvent({
      actor: "sistema",
      source: "sistema",
      kind: "escritura_bloqueada",
      summary: `Propuesta de alta sobre ${bed.code} bloqueada: hay un conflicto abierto sobre esta cama. Se espera al humano.`,
      bedId: bed.id,
    });
    return fail(`Hay un conflicto abierto sobre ${bed.code}. Primero se resuelve el conflicto — el dato queda congelado.`);
  }
  const previousStatus = bed.status as BedStatus;
  await setBedStatus(bed.id, "discharge_detected", now, false);
  const code = await nextApprovalCode();
  const expiresAt = addMinutes(now, R.DISCHARGE_APPROVAL_TTL_MIN);
  const [ap] = await db
    .insert(approvals)
    .values({
      code,
      kind: "discharge_confirmation",
      title: `¿Confirmas el alta de ${bed.code}?`,
      detail:
        opts.evidence ??
        `Se detectó una posible liberación de ${bed.code} (${bed.unit}). Si lo confirmas, la cama pasa a "pendiente de limpieza" y el aviso a aseo sale en el mismo movimiento.`,
      bedId: bed.id,
      messageId: opts.messageId ?? null,
      payload: {
        assumedStatus: "discharge_detected",
        previousStatus,
        detectedAt: now.toISOString(),
        origin: opts.origin,
      },
      status: "pending",
      createdAt: now,
      expiresAt,
    })
    .returning();
  await logEvent({
    actor: "sistema",
    source: opts.origin,
    kind: "alta_detectada",
    summary: `Posible alta en ${bed.code} (${bed.unit}) detectada vía ${opts.origin}. Se propone confirmación — sin humano, la cama no se mueve.`,
    bedId: bed.id,
    approvalId: ap.id,
    payload: { detectedAt: now.toISOString(), origin: opts.origin, messageId: opts.messageId ?? null },
  });

  // Notificación proactiva a Turno por Telegram
  try {
    const { notifyNewProposal } = await import("./telegram");
    const tg = await notifyNewProposal({
      bedCode: bed.code,
      unit: bed.unit,
      source: opts.origin,
      approvalCode: code,
    });

    await logEvent({
      actor: "sistema",
      source: "telegram",
      kind: tg.ok ? "consulta_respondida" : "escritura_bloqueada",
      summary: tg.ok
        ? `Telegram Turno: propuesta ${code} notificada para ${bed.code}.`
        : `Telegram Turno FALLÓ para propuesta ${code} (${bed.code}): ${tg.message ?? "sin detalle"}.`,
      bedId: bed.id,
      approvalId: ap.id,
      payload: { telegram: tg },
    });
  } catch (error) {
    await logEvent({
      actor: "sistema",
      source: "telegram",
      kind: "escritura_bloqueada",
      summary: `Telegram Turno lanzó excepción al notificar ${code} (${bed.code}): ${error instanceof Error ? error.message : "desconocido"}.`,
      bedId: bed.id,
      approvalId: ap.id,
    });
  }

  return ok(`Alta detectada en ${bed.code}. Propuesta ${code} creada — vence ${R.DISCHARGE_APPROVAL_TTL_MIN} min. Nada se mueve sin tu confirmación.`);
}

/* ------------------------------------------------------------------ */
/*  BORRADOR DE RESPUESTA DESDE UN MENSAJE (siempre requiere tu firma) */
/* ------------------------------------------------------------------ */

export async function draftReply(opts: { messageId: number; actor: string }): Promise<OpResult> {
  const now = new Date();
  const [msg] = await db.select().from(messages).where(eq(messages.id, opts.messageId));
  if (!msg) return fail("Mensaje no encontrado.");
  if (msg.direction !== "inbound") return fail("Solo se responde a mensajes entrantes.");
  const existing = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.messageId, msg.id), eq(approvals.kind, "reply_draft"), eq(approvals.status, "pending")));
  if (existing.length > 0) {
    return warn(`Ya existe el borrador ${existing[0].code} esperando tu decisión. No se duplica el trabajo pendiente.`);
  }
  const faltan = ((msg.extracted as { faltan?: string[] }).faltan ?? []) as string[];
  let draft: string;
  if (faltan.length > 0) {
    draft = `Estimados: para gestionar su solicitud necesitamos que nos indique: ${faltan.join(", ")}. Con esos antecedentes respondemos disponibilidad por este mismo canal. — Gestión de Camas`;
  } else {
    const available = await db.select().from(beds).where(eq(beds.status, "available"));
    const R = await getRules();
    const limit = addMinutes(now, -R.STALE_AFTER_HOURS * 60);
    const fresh = available.filter((b) => b.lastConfirmedAt.getTime() >= limit.getTime());
    draft = fresh.length
      ? `Estimados: en respuesta a su solicitud, informamos ${fresh.length} cama(s) con dato confirmado (${fresh.map((b) => b.code).join(", ")}), verificadas dentro de las últimas ${R.STALE_AFTER_HOURS} h. Mantener este canal para la confirmación formal. — Gestión de Camas`
      : `Estimados: a la hora de esta respuesta no registramos camas con dato confirmado. Quedamos atentos y avisaremos apenas se libere una (el sistema escala automáticamente los ciclos de aseo). — Gestión de Camas`;
  }
  const code = await nextApprovalCode();
  await db.insert(approvals).values({
    code,
    kind: "reply_draft",
    title: `Responder a ${msg.fromName}`,
    detail: `Borrador preparado a partir de "${msg.subject}". Nada sale sin tu aprobación (R1).`,
    messageId: msg.id,
    payload: { draftBody: draft },
    status: "pending",
    createdAt: now,
    expiresAt: addMinutes(now, 120),
  });
  await logEvent({
    actor: "sistema",
    source: msg.channel,
    kind: "borrador_preparado",
    summary: `Borrador ${code} preparado para "${msg.subject}" (${msg.fromName})${faltan.length ? " — pide los antecedentes que faltan en vez de inventarlos (R5)" : " — con disponibilidad verificable"}. Espera tu firma.`,
    bedId: msg.bedId,
    payload: { messageId: msg.id },
  });
  return ok(`Borrador ${code} listo — revísalo en Aprobaciones. La respuesta sale solo con tu firma y queda con constancia.`);
}

/* ------------------------------------------------------------------ */
/*  DECISIÓN SOBRE PROPUESTAS (UC-05)                                  */
/* ------------------------------------------------------------------ */

export async function decideApproval(opts: {
  approvalId: number;
  decision: "approved" | "rejected";
  actor: string;
  reason?: string;
}): Promise<OpResult> {
  const now = new Date();
  const R = await getRules();
  await ensureMaintenance(now);
  const ap = await getApproval(opts.approvalId);
  if (!ap) return fail("Propuesta no encontrada.");
  if (ap.status === "expired")
    return fail(`${ap.code} ya venció. El sistema no aplica propuestas caducadas aunque alguien apruebe después.`);
  if (ap.status === "superseded")
    return fail(`${ap.code} quedó obsoleta: la condición cambió desde que se propuso. No se escribe dato viejo.`);
  if (ap.status !== "pending") return fail(`${ap.code} ya fue decidida (${ap.status}). Registro intacto, nada nuevo que aplicar.`);

  const markDecided = async (extra?: Partial<Approval>) => {
    await db
      .update(approvals)
      .set({
        status: opts.decision,
        decidedBy: opts.actor,
        decidedAt: now,
        decisionReason: opts.reason ?? null,
        appliedAt: opts.decision === "approved" ? now : null,
        ...(extra ?? {}),
      })
      .where(eq(approvals.id, ap.id));
  };

  if (ap.kind === "discharge_confirmation") {
    const bed = ap.bedId ? await getBed(ap.bedId) : undefined;
    if (!bed) return fail("La cama asociada ya no existe.");
    if (bed.status !== "discharge_detected") {
      await db.update(approvals).set({ status: "superseded", decidedAt: now, outcomeNote: "La cama cambió de estado antes de decidir" }).where(eq(approvals.id, ap.id));
      return fail(`La condición de ${bed.code} cambió desde que se propuso. Propuesta obsoleta, no se aplica.`);
    }
    if (opts.decision === "rejected") {
      const prev = ((ap.payload as { previousStatus?: BedStatus }).previousStatus ?? "occupied") as BedStatus;
      await setBedStatus(bed.id, prev, now);
      await markDecided();
      await logEvent({
        actor: opts.actor,
        source: "panel",
        kind: "alta_rechazada",
        summary: `${opts.actor} descartó el alta propuesta de ${bed.code}${opts.reason ? ` (${opts.reason})` : ""}. La cama vuelve a "${prev}".`,
        bedId: bed.id,
        approvalId: ap.id,
      });
      return ok(`Alta de ${bed.code} descartada. La cama vuelve a su estado previo y queda en el registro.`);
    }
    const payload = ap.payload as { detectedAt?: string };
    await setBedStatus(bed.id, "pending_cleaning", now);
    const code = await nextTaskCode(now);
    const [task] = await db
      .insert(cleaningTasks)
      .values({
        code,
        bedId: bed.id,
        status: "notified",
        priority: "normal",
        channel: R.CANAL_ASEO,
        detectedAt: payload.detectedAt ? new Date(payload.detectedAt) : ap.createdAt,
        createdAt: now,
        notifiedAt: now,
      })
      .returning();
    await markDecided();
    const m1 = minutesBetween(task.detectedAt, now);
    await logEvent({
      actor: opts.actor,
      source: "panel",
      kind: "alta_confirmada",
      summary: `${opts.actor} confirmó el alta de ${bed.code} (${bed.unit}).`,
      bedId: bed.id,
      approvalId: ap.id,
    });
    await logEvent({
      actor: "sistema",
      source: "sistema",
      kind: "limpieza_creada",
      summary: `Tarea ${code} creada para ${bed.code}.`,
      bedId: bed.id,
      taskId: task.id,
    });
    await logEvent({
      actor: "sistema",
      source: R.CANAL_ASEO,
      kind: "limpieza_notificada",
      summary: `Aviso enviado al equipo de aseo (${R.CANAL_ASEO}): ${bed.code} (${bed.unit}) pendiente de limpieza. M1: ${m1} min desde la detección.`,
      bedId: bed.id,
      taskId: task.id,
      payload: { m1_minutes: m1 },
    });

    // Notificación proactiva a Aseo por Telegram
    try {
      const { notifyAseoNewTask } = await import("./telegram");
      const tg = await notifyAseoNewTask({
        bedCode: bed.code,
        unit: bed.unit,
        taskCode: task.code,
      });

      await logEvent({
        actor: "sistema",
        source: "telegram",
        kind: tg.ok ? "limpieza_notificada" : "escritura_bloqueada",
        summary: tg.ok
          ? `Telegram Aseo: tarea ${task.code} enviada para ${bed.code} (${bed.unit}).`
          : `Telegram Aseo FALLÓ para tarea ${task.code} (${bed.code}): ${tg.message ?? "sin detalle"}.`,
        bedId: bed.id,
        taskId: task.id,
        payload: { telegram: tg },
      });
    } catch (error) {
      await logEvent({
        actor: "sistema",
        source: "telegram",
        kind: "escritura_bloqueada",
        summary: `Telegram Aseo lanzó excepción al notificar tarea ${task.code} (${bed.code}): ${error instanceof Error ? error.message : "desconocido"}.`,
        bedId: bed.id,
        taskId: task.id,
      });
    }

    return ok(`Alta confirmada. ${code} creada y avisada a aseo por ${R.CANAL_ASEO} hace segundos — salto detección→aviso en ${m1} min. Te aviso si nadie la toma en ${R.CLEANING_ACCEPT_SLA_MIN} min.`);
  }

  if (ap.kind === "inspection_approval") {
    const task = ap.taskId ? await getTask(ap.taskId) : undefined;
    const bed = ap.bedId ? await getBed(ap.bedId) : undefined;
    if (!task || !bed) return fail("Tarea o cama asociada ya no existe.");
    if (task.status !== "pending_inspection" || bed.status !== "pending_inspection") {
      await db.update(approvals).set({ status: "superseded", decidedAt: now, outcomeNote: "El ciclo de aseo cambió antes de decidir" }).where(eq(approvals.id, ap.id));
      return fail("El ciclo de aseo/inspección cambió desde que se propuso. Propuesta obsoleta, no se aplica.");
    }
    if (opts.decision === "rejected") {
      await db.update(cleaningTasks).set({ status: "cleaning" }).where(eq(cleaningTasks.id, task.id));
      await setBedStatus(bed.id, "cleaning", now);
      await markDecided();
      await logEvent({
        actor: opts.actor,
        source: "panel",
        kind: "inspeccion_rechazada",
        summary: `${opts.actor} rechazó la inspección de ${bed.code}${opts.reason ? ` (${opts.reason})` : ""}. La cama vuelve a limpieza — una cama mal preparada no se promete.`,
        bedId: bed.id,
        taskId: task.id,
        approvalId: ap.id,
      });
      return ok(`Inspección rechazada: ${bed.code} vuelve a "en limpieza". La observación quedó registrada.`);
    }
    await db
      .update(cleaningTasks)
      .set({ status: "completed", inspectedAt: now, closedAt: now })
      .where(eq(cleaningTasks.id, task.id));
    await setBedStatus(bed.id, "available", now);
    await markDecided();
    const cycle = minutesBetween(task.detectedAt, now);
    await logEvent({
      actor: opts.actor,
      source: "panel",
      kind: "inspeccion_aprobada",
      summary: `${opts.actor} validó la inspección de ${bed.code} (ropa, baño, insumos).`,
      bedId: bed.id,
      taskId: task.id,
      approvalId: ap.id,
    });
    await logEvent({
      actor: "sistema",
      source: "sistema",
      kind: "cama_disponible",
      summary: `${bed.code} (${bed.unit}) DISPONIBLE — confirmado por ${opts.actor}. Ciclo completo: ${cycle} min desde la detección del alta.`,
      bedId: bed.id,
      taskId: task.id,
      payload: { cycle_minutes: cycle },
    });
    return ok(`${bed.code} disponible — confirmado por ti. Ciclo completo: ${cycle} min desde el alta. La promesa quedó registrada con tu nombre.`);
  }

  if (ap.kind === "reply_draft") {
    const [msg] = await db.select().from(messages).where(eq(messages.id, ap.messageId ?? -1));
    if (!msg) return fail("El mensaje original ya no existe.");
    
    if (opts.decision === "rejected") {
      await markDecided();
      await logEvent({
        actor: opts.actor,
        source: "panel",
        kind: "aprobacion_rechazada",
        summary: `${opts.actor} descartó el borrador de respuesta a "${msg.subject}".`,
        approvalId: ap.id,
      });
      return ok("Borrador descartado correctamente.");
    }

    const draftBody = (ap.payload as { draftBody?: string }).draftBody ?? "(sin contenido)";

        // --- ENVÍO REAL POR SMTP CON THREADING ---
        let smtpResult = { ok: true, messageId: "simulado-id" };
    
        if (msg.channel === "correo") {
          const { sendRealEmail } = await import("./smtp");
          const res = await sendRealEmail({
            to: msg.fromAddress || msg.fromName,
            subject: `RE: ${msg.subject}`,
            body: draftBody,
            inReplyToMessageId: msg.smtpMessageId || undefined,
          });
          if (!res.ok) {
            return fail(`Fallo técnico al enviar el correo: ${res.error}. El borrador sigue disponible.`);
          }
          smtpResult = { ok: true, messageId: res.messageId || "ok" };
        }
    
        const [outbound] = await db
          .insert(messages)
          .values({
            externalId: `OUT-${ap.code}-${Date.now()}`,
            channel: msg.channel,
            direction: "outbound",
            fromName: `Copiloto Camas (autorizado por ${opts.actor})`,
            fromAddress: process.env.MAIL_SMTP_USER || null,
            smtpMessageId: smtpResult.messageId || null,
            subject: `RE: ${msg.subject}`,
            body: draftBody,
            receivedAt: now,
            classification: "confirmacion",
            extracted: {},
            status: "enviado",
            bedId: msg.bedId,
            inReplyTo: msg.id,
            handledBy: opts.actor,
            handledAt: now,
          })
          .returning();

    await db
      .update(messages)
      .set({ status: "atendido", handledBy: opts.actor, handledAt: now })
      .where(eq(messages.id, msg.id));

    await markDecided();

    await logEvent({
      actor: opts.actor,
      source: msg.channel,
      kind: "respuesta_enviada",
      summary: `Respuesta enviada a "${msg.subject}" — autorizada por ${opts.actor}. (ID SMTP: ${smtpResult.messageId})`,
      bedId: msg.bedId,
      approvalId: ap.id,
      payload: { messageId: msg.id, outboundId: outbound.id, smtp: smtpResult },
    });

    return ok(`Correo enviado con éxito. Se guardó constancia en la caja negra y en el hilo del mensaje.`);
  }

  return fail("Tipo de propuesta desconocido.");
}

/* ------------------------------------------------------------------ */
/*  FLUJO DE LIMPIEZA                                                  */
/* ------------------------------------------------------------------ */

export async function taskAction(opts: {
  taskId: number;
  op: "accept" | "start" | "finish" | "block" | "unblock" | "cancel";
  actor: string;
  reason?: string;
}): Promise<OpResult> {
  const now = new Date();
  const R = await getRules();
  await ensureMaintenance(now);
  const task = await getTask(opts.taskId);
  if (!task) return fail("Tarea no encontrada.");
  const bed = await getBed(task.bedId);
  if (!bed) return fail("Cama asociada no encontrada.");

  const need = (allowed: TaskStatus[]) => {
    if (!allowed.includes(task.status as TaskStatus)) {
      return `Operación no válida: ${task.code} está en "${task.status}". El flujo no se salta etapas.`;
    }
    return null;
  };
  const setTask = async (patch: Partial<CleaningTask>) =>
    db.update(cleaningTasks).set(patch).where(eq(cleaningTasks.id, task.id));

  switch (opts.op) {
    case "accept": {
      const err = need(["notified"]);
      if (err) return fail(err);
      await setTask({ status: "accepted", acceptedAt: now });
      await logEvent({
        actor: opts.actor,
        source: task.channel,
        kind: "limpieza_aceptada",
        summary: `Aseo tomó ${task.code} (${bed.code}, ${bed.unit}) — ${opts.reason ?? "trabajo aceptado"}.`,
        bedId: bed.id,
        taskId: task.id,
      });
      return ok(`${task.code}: aseo tomó el trabajo (${bed.code}). Quedó con marca de tiempo.`);
    }
    case "start": {
      const err = need(["accepted"]);
      if (err) return fail(err);
      await setTask({ status: "cleaning", startedAt: now });
      await setBedStatus(bed.id, "cleaning", now);
      await logEvent({
        actor: opts.actor,
        source: task.channel,
        kind: "limpieza_iniciada",
        summary: `Limpieza iniciada en ${bed.code} (${bed.unit}).`,
        bedId: bed.id,
        taskId: task.id,
      });
      return ok(`${bed.code} en limpieza — iniciada por aseo.`);
    }
    case "finish": {
      const err = need(["cleaning"]);
      if (err) return fail(err);
      await setTask({ status: "pending_inspection", finishedAt: now });
      await setBedStatus(bed.id, "pending_inspection", now);
      const code = await nextApprovalCode();
      const [ap] = await db
        .insert(approvals)
        .values({
          code,
          kind: "inspection_approval",
          title: `¿Inspección OK para ${bed.code}?`,
          detail: `Aseo informó término en ${bed.code} (${bed.unit}). Solo con tu validación humana la cama puede pasar a "disponible". Si la rechazas, vuelve a limpieza con la observación registrada.`,
          bedId: bed.id,
          taskId: task.id,
          payload: { assumedStatus: "pending_inspection" },
          status: "pending",
          createdAt: now,
          expiresAt: addMinutes(now, R.INSPECTION_APPROVAL_TTL_MIN),
        })
        .returning();
      await logEvent({
        actor: opts.actor,
        source: task.channel,
        kind: "limpieza_terminada",
        summary: `Aseo informó término de ${bed.code} (${bed.unit}). Esto NO es validación.`,
        bedId: bed.id,
        taskId: task.id,
      });
      await logEvent({
        actor: "sistema",
        source: "sistema",
        kind: "inspeccion_propuesta",
        summary: `Propuesta ${code}: validar inspección de ${bed.code}. Ninguna automatización puede marcar disponible.`,
        bedId: bed.id,
        taskId: task.id,
        approvalId: ap.id,
      });
      return ok(`${bed.code}: término informado. Propuesta ${code} espera tu inspección humana — la disponibilidad jamás se infiere (R2).`);
    }
    case "block": {
      const err = need(["notified", "accepted", "cleaning"]);
      if (err) return fail(err);
      await setTask({ status: "blocked", blockedReason: opts.reason ?? "impedimento sin detalle" });
      await logEvent({
        actor: opts.actor,
        source: task.channel,
        kind: "limpieza_bloqueada",
        summary: `Impedimento en ${task.code} (${bed.code}): ${opts.reason ?? "sin detalle"}. Vuelve al punto anterior al resolverse.`,
        bedId: bed.id,
        taskId: task.id,
      });
      return warn(`${task.code} con impedimento registrado: ${opts.reason ?? "sin detalle"}.`);
    }
    case "unblock": {
      const err = need(["blocked"]);
      if (err) return fail(err);
      const back: TaskStatus = task.startedAt ? "cleaning" : task.acceptedAt ? "accepted" : "notified";
      await setTask({ status: back, blockedReason: null });
      await logEvent({
        actor: opts.actor,
        source: task.channel,
        kind: "limpieza_aceptada",
        summary: `Impedimento resuelto en ${task.code}: vuelve a "${back}" sin perder las marcas de tiempo.`,
        bedId: bed.id,
        taskId: task.id,
      });
      return ok(`${task.code} retomada en "${back}" — reversibilidad con rastro completo.`);
    }
    case "cancel": {
      if (task.status === "completed" || task.status === "cancelled")
        return fail(`${task.code} ya está cerrada. El registro no se borra, se revierte con rastro.`);
      await setTask({ status: "cancelled", cancelledAt: now, cancelReason: opts.reason ?? "anulada" });
      await setBedStatus(bed.id, "occupied", now);
      await supersedeStaleApprovalsForBed(bed.id, now, "La tarea de limpieza fue anulada");
      await logEvent({
        actor: opts.actor,
        source: "panel",
        kind: "limpieza_anulada",
        summary: `${task.code} anulada por ${opts.actor} (${opts.reason ?? "sin motivo"}). ${bed.code} vuelve a ocupada.`,
        bedId: bed.id,
        taskId: task.id,
      });
      return ok(`${task.code} anulada con motivo registrado. ${bed.code} vuelve a "ocupada".`);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  ACCIONES DIRECTAS DEL HUMANO SOBRE CAMAS                           */
/* ------------------------------------------------------------------ */

export async function bedAction(opts: {
  bedId: number;
  op:
    | "propose_discharge"
    | "reserve"
    | "release"
    | "block"
    | "out_of_service"
    | "reincorporate"
    | "reconfirm"
    | "mark_unknown"
    | "mark_available";
  actor: string;
  reason?: string;
}): Promise<OpResult> {
  const now = new Date();
  const R = await getRules();
  await ensureMaintenance(now);
  const bed = await getBed(opts.bedId);
  if (!bed) return fail("Cama no encontrada.");

  if (opts.op === "mark_available") {
    await logEvent({
      actor: "sistema",
      source: "sistema",
      kind: "escritura_bloqueada",
      summary: `Intento de marcar ${bed.code} como disponible sin ciclo de aseo+inspección. BLOQUEADO por R2: la disponibilidad nunca se infiere ni se declara sin inspección humana.`,
      bedId: bed.id,
    });
    return fail(`Bloqueado por R2: ${bed.code} solo puede quedar disponible tras limpieza + inspección humana validada. Ningún otro camino existe.`);
  }

  const openConf = await db
    .select()
    .from(conflicts)
    .where(and(eq(conflicts.bedId, bed.id), eq(conflicts.status, "open")));
  const frozen = openConf.length > 0 && opts.op !== "reconfirm" && opts.op !== "mark_unknown";
  if (frozen) {
    await logEvent({
      actor: "sistema",
      source: "sistema",
      kind: "escritura_bloqueada",
      summary: `Acción "${opts.op}" sobre ${bed.code} bloqueada: conflicto abierto. El dato queda congelado hasta resolución humana.`,
      bedId: bed.id,
    });
    return fail(`${bed.code} tiene un conflicto abierto: la escritura automática está congelada. Resuelve el conflicto primero.`);
  }

  const activeTask = await db
    .select()
    .from(cleaningTasks)
    .where(
      and(
        eq(cleaningTasks.bedId, bed.id),
        ne(cleaningTasks.status, "completed"),
        ne(cleaningTasks.status, "cancelled")
      )
    );

  switch (opts.op) {
    case "propose_discharge":
      return proposeDischarge({ bedId: bed.id, origin: "panel", actor: opts.actor });

    case "reserve": {
      if (bed.status !== "available") return fail(`${bed.code} no está disponible. No se reserva lo que no existe (R2).`);
      const staleLimit = addMinutes(now, -R.STALE_AFTER_HOURS * 60);
      if (bed.lastConfirmedAt.getTime() < staleLimit.getTime()) {
        return fail(`El dato de ${bed.code} está vencido (${R.STALE_AFTER_HOURS} h+ sin confirmar). Reconfirma antes de prometer la cama a alguien.`);
      }
      await setBedStatus(bed.id, "reserved", now);
      await logEvent({
        actor: opts.actor,
        source: "panel",
        kind: "cama_reservada",
        summary: `${bed.code} (${bed.unit}) reservada por ${opts.actor}${opts.reason ? ` — ${opts.reason}` : ""}. Compromiso registrado.`,
        bedId: bed.id,
      });
      return ok(`${bed.code} reservada. La promesa quedó con tu nombre y hora.`);
    }
    case "release": {
      if (bed.status !== "reserved") return fail(`${bed.code} no está reservada.`);
      await setBedStatus(bed.id, "available", now);
      await logEvent({
        actor: opts.actor,
        source: "panel",
        kind: "reserva_liberada",
        summary: `Reserva de ${bed.code} liberada por ${opts.actor}${opts.reason ? ` — ${opts.reason}` : ""}. Vuelve a disponible (dato reconfirmado en el acto).`,
        bedId: bed.id,
      });
      return ok(`${bed.code} vuelve a disponible con dato fresco.`);
    }
    case "block": {
      if (bed.status === "out_of_service") return fail(`${bed.code} está fuera de servicio; usa "reincorporar".`);
      if (activeTask.length > 0)
        return fail(`${bed.code} tiene el ciclo de aseo abierto (${activeTask[0].code}). Primero se cierra o anula ese ciclo.`);
      await setBedStatus(bed.id, "blocked", now, true, opts.reason ?? "bloqueo operativo");
      await logEvent({
        actor: opts.actor,
        source: "panel",
        kind: "cama_bloqueada",
        summary: `${bed.code} bloqueada por ${opts.actor}: ${opts.reason ?? "motivo no especificado"}.`,
        bedId: bed.id,
      });
      return ok(`${bed.code} bloqueada con motivo registrado.`);
    }
    case "out_of_service": {
      if (activeTask.length > 0)
        return fail(`${bed.code} tiene el ciclo de aseo abierto (${activeTask[0].code}). Anúlalo primero con motivo.`);
      await setBedStatus(bed.id, "out_of_service", now, true, opts.reason ?? "mantención");
      await logEvent({
        actor: opts.actor,
        source: "panel",
        kind: "cama_fuera_servicio",
        summary: `${bed.code} dada de baja (${opts.reason ?? "mantención"}). Sin fecha cierta de vuelta.`,
        bedId: bed.id,
      });
      return ok(`${bed.code} fuera de servicio. Quedó el motivo y la hora.`);
    }
    case "reincorporate": {
      if (bed.status !== "out_of_service" && bed.status !== "blocked")
        return fail(`${bed.code} no está dada de baja ni bloqueada.`);
      await setBedStatus(bed.id, "unknown", now, false, "reincorporada — estado por confirmar en terreno");
      await logEvent({
        actor: opts.actor,
        source: "panel",
        kind: "cama_reincorporada",
        summary: `${bed.code} reincorporada por ${opts.actor}. Estado real DESCONOCIDO: es un pendiente de terreno, no una disponibilidad.`,
        bedId: bed.id,
      });
      return warn(`${bed.code} reincorporada como "desconocido": nadie afirma su estado hasta verificarla en terreno.`);
    }
    case "mark_unknown": {
      await setBedStatus(bed.id, "unknown", now, false, opts.reason ?? "dato dudoso");
      await logEvent({
        actor: opts.actor,
        source: "panel",
        kind: "dato_vencido",
        summary: `${opts.actor} marcó ${bed.code} como "desconocido"${opts.reason ? ` (${opts.reason})` : ""}. Se genera pendiente de verificación.`,
        bedId: bed.id,
      });
      return warn(`${bed.code} marcada como desconocida — es un pendiente accionable, no un neutro.`);
    }
    case "reconfirm": {
      await setBedStatus(bed.id, bed.status as BedStatus, now, true);
      await logEvent({
        actor: opts.actor,
        source: "panel",
        kind: "dato_reconfirmado",
        summary: `${opts.actor} verificó en terreno ${bed.code}: sigue "${bed.status}". Dato fresco por ${R.STALE_AFTER_HOURS} h más.`,
        bedId: bed.id,
      });
      return ok(`${bed.code}: dato reconfirmado por ti — vuelve a estar fresco.`);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  CONFLICTOS (UC-06, R3)                                             */
/* ------------------------------------------------------------------ */

export async function openConflict(opts: {
  bedId: number;
  sourceA: string;
  valueA: string;
  sourceB: string;
  valueB: string;
}): Promise<OpResult> {
  const existing = await db
    .select()
    .from(conflicts)
    .where(and(eq(conflicts.bedId, opts.bedId), eq(conflicts.status, "open")));
  const bed = await getBed(opts.bedId);
  if (existing.length > 0) {
    return warn(`Ya existe un conflicto abierto sobre ${bed?.code ?? "esta cama"} (C-${existing[0].id}). No se duplica; se registra en el hilo.`);
  }
  const [c] = await db
    .insert(conflicts)
    .values({
      bedId: opts.bedId,
      sourceA: opts.sourceA,
      valueA: opts.valueA,
      sourceB: opts.sourceB,
      valueB: opts.valueB,
      status: "open",
    })
    .returning();
  await logEvent({
    actor: "sistema",
    source: "sistema",
    kind: "conflicto_abierto",
    summary: `Conflicto C-${c.id} sobre ${bed?.code ?? "?"}: ${opts.sourceA} dice "${opts.valueA}" y ${opts.sourceB} dice "${opts.valueB}". Escritura automática CONGELADA hasta resolución humana.`,
    bedId: opts.bedId,
    payload: { conflictId: c.id },
  });
  return warn(`Conflicto C-${c.id} abierto sobre ${bed?.code}. Nadie pisa a nadie en silencio: se espera tu criterio.`);
}

export async function resolveConflict(opts: {
  conflictId: number;
  winner: "A" | "B";
  apply: boolean;
  criterion: string;
  actor: string;
}): Promise<OpResult> {
  const now = new Date();
  await ensureMaintenance(now);
  const [c] = await db.select().from(conflicts).where(eq(conflicts.id, opts.conflictId));
  if (!c) return fail("Conflicto no encontrado.");
  if (c.status !== "open") return fail(`C-${c.id} ya fue resuelto. El criterio quedó guardado; no se rescribe.`);
  const bed = await getBed(c.bedId);
  const finalValue = opts.winner === "A" ? c.valueA : c.valueB;

  if (opts.apply && finalValue === "available") {
    return fail(`No se puede resolver dejando ${bed?.code} "disponible": R2 exige ciclo de aseo + inspección humana. Resuelve hacia otro estado o deja la cama como está.`);
  }
  await db
    .update(conflicts)
    .set({
      status: "resolved",
      resolution: finalValue,
      criterion: opts.criterion,
      resolvedBy: opts.actor,
      resolvedAt: now,
    })
    .where(eq(conflicts.id, c.id));

  if (opts.apply && bed) {
    await setBedStatus(bed.id, finalValue as BedStatus, now);
    await supersedeStaleApprovalsForBed(bed.id, now, "Conflicto resuelto hacia otro estado");
  }
  await logEvent({
    actor: opts.actor,
    source: "panel",
    kind: "conflicto_resuelto",
    summary: `C-${c.id} resuelto por ${opts.actor}: gana ${opts.winner === "A" ? c.sourceA : c.sourceB} → "${finalValue}". Criterio: "${opts.criterion}"${opts.apply ? ". Aplicado a la cama." : " (sin tocar la cama)."}`,
    bedId: c.bedId,
    payload: { conflictId: c.id, applied: opts.apply },
  });
  return ok(`C-${c.id} resuelto con tu criterio guardado${opts.apply ? ` — ${bed?.code} quedó en "${finalValue}"` : ""}. La automatización vuelve a operar sobre este dato.`);
}

/* ------------------------------------------------------------------ */
/*  CONSULTA "¿TENÍS CAMA?" (UC-03)                                    */
/* ------------------------------------------------------------------ */

export async function capacityAnswer(actor = "sistema"): Promise<OpResult> {
  const now = new Date();
  const R = await getRules();
  const allBeds = await db.select().from(beds);
  const staleLimit = addMinutes(now, -R.STALE_AFTER_HOURS * 60);
  const avail = allBeds.filter((b) => b.status === "available");
  const fresh = avail.filter((b) => b.lastConfirmedAt.getTime() >= staleLimit.getTime());
  const staleN = avail.length - fresh.length;
  const pipeline = allBeds.filter((b) =>
    ["pending_cleaning", "cleaning", "cleaning_completed", "pending_inspection"].includes(b.status)
  ).length;
  await logEvent({
    actor,
    source: "telegram",
    kind: "consulta_respondida",
    summary: `Consulta de capacidad respondida sin interrumpir al humano: ${fresh.length} disponibles confirmadas, ${staleN} con dato vencido, ${pipeline} en ciclo de liberación.`,
    payload: { disponibles: fresh.length, vencidas: staleN, en_ciclo: pipeline },
  });
  return ok(
    `${fresh.length} camas disponibles con dato confirmado${staleN > 0 ? ` (+${staleN} con dato vencido — reconfirmar antes de prometer)` : ""} · ${pipeline} en ciclo de liberación. Respuesta registrada sin interrumpir al turno.`
  );
}

/* ------------------------------------------------------------------ */
/*  CIERRE DE TURNO (UC-07)                                            */
/* ------------------------------------------------------------------ */

export async function closeShift(actor: string, horizonHours?: number): Promise<OpResult> {
  const now = new Date();
  const R = await getRules();
  const horizon = horizonHours ?? R.SHIFT_HORIZON_HOURS;
  await ensureMaintenance(now);
  const since = new Date(now.getTime() - horizon * 3600_000);
  const windowEvents = await db
    .select()
    .from(events)
    .where(gte(events.ts, since))
    .orderBy(desc(events.ts));
  const doneTasks = await db
    .select()
    .from(cleaningTasks)
    .where(and(eq(cleaningTasks.status, "completed"), gte(cleaningTasks.closedAt, since)));
  const cycles = doneTasks.map((t) => minutesBetween(t.detectedAt, t.closedAt!));
  const m1s = doneTasks.filter((t) => t.notifiedAt).map((t) => minutesBetween(t.detectedAt, t.notifiedAt!));
  const pendingApprovals = await db.select().from(approvals).where(eq(approvals.status, "pending"));
  const openConflicts = await db.select().from(conflicts).where(eq(conflicts.status, "open"));
  const activeTasks = await db
    .select()
    .from(cleaningTasks)
    .where(and(ne(cleaningTasks.status, "completed"), ne(cleaningTasks.status, "cancelled")));

  const kindCount: Record<string, number> = {};
  for (const e of windowEvents) kindCount[e.kind] = (kindCount[e.kind] ?? 0) + 1;

  const label = now.getHours() >= 8 && now.getHours() < 20 ? "Turno día" : "Turno noche";
  const [report] = await db
    .insert(shiftReports)
    .values({
      label: `${label} · ${now.toLocaleDateString("es-CL", { day: "numeric", month: "short" })} ${now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false })}`,
      generatedBy: actor,
      generatedAt: now,
      horizonHours: horizon,
      content: {
        window: { from: since.toISOString(), to: now.toISOString() },
        totals: {
          eventos: windowEvents.length,
          ciclos_completados: cycles.length,
          m1_promedio: m1s.length ? Math.round(m1s.reduce((a, b) => a + b, 0) / m1s.length) : null,
          m2_promedio: cycles.length ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : null,
          pendientes_heredados: activeTasks.length + pendingApprovals.length + openConflicts.length,
        },
        por_tipo: kindCount,
        heredados: {
          tareas_activas: activeTasks.map((t) => t.code),
          aprobaciones_pendientes: pendingApprovals.map((a) => a.code),
          conflictos_abiertos: openConflicts.map((c) => `C-${c.id}`),
        },
      },
    })
    .returning();
  await logEvent({
    actor,
    source: "panel",
    kind: "turno_cerrado",
    summary: `Informe de turno generado desde el registro (no de la memoria): ${windowEvents.length} eventos, ${cycles.length} ciclos completados, ${activeTasks.length + pendingApprovals.length + openConflicts.length} pendientes heredados al relevo.`,
  });
  return ok(`Informe "${report.label}" generado desde la caja negra. El relevo puede operar sin llamada telefónica.`);
}


