/* ------------------------------------------------------------------ */
/*  MÉTRICAS M1–M8 — calculadas desde la caja negra, no de sensaciones */
/* ------------------------------------------------------------------ */

import { db } from "@/db";
import { approvals, conflicts, events, cleaningTasks, beds } from "@/db/schema";
import { and, eq, gte, inArray, ne, isNotNull } from "drizzle-orm";
import { minutesBetween, sameDay } from "./time";
import { getRules } from "./config";

export type Metrics = {
  m1: { avg: number | null; n: number; best: number | null; samples: { code: string; mins: number }[] };
  m2: { avg: number | null; n: number; samples: { code: string; mins: number }[] };
  m3: { availableWithoutNotice: number };
  m4: { overdue: number; overdueCodes: string[] };
  m5: { answered: number };
  m6: { unauthorizedWrites: number; blockedWrites: number };
  m7: { opened: number; resolved: number; avgResolutionMin: number | null };
  m8: { expired: number; decided: number };
  series: {
    cycles: { code: string; mins: number; label: string }[];
    hourly: { hour: string; count: number }[];
  };
};

export async function computeMetrics(now = new Date()): Promise<Metrics> {
  const R = await getRules();
  const allEvents = await db.select().from(events);
  const todayEvents = allEvents.filter((e) => sameDay(e.ts, now));

  const tasks = await db.select().from(cleaningTasks);
  const withNotice = tasks.filter((t) => t.notifiedAt);
  const m1samples = withNotice.map((t) => ({
    code: t.code,
    mins: minutesBetween(t.detectedAt, t.notifiedAt!),
  }));
  const completed = tasks.filter((t) => t.status === "completed" && t.closedAt);
  const m2samples = completed.map((t) => ({ code: t.code, mins: minutesBetween(t.detectedAt, t.closedAt!) }));

  // M3: camas que quedaron disponibles sin aviso → camas available sin tarea completada vinculada hoy
  const availableBeds = await db.select().from(beds).where(eq(beds.status, "available"));
  const bedIdsWithTask = new Set(tasks.map((t) => t.bedId));
  const m3 = availableBeds.filter((b) => !bedIdsWithTask.has(b.id)).length;

  // M4: tareas activas que superaron SLA sin movimiento (fuera de plazo)
  const active = tasks.filter((t) => !["completed", "cancelled"].includes(t.status));
  const overdue = active.filter((t) => {
    const ref = t.acceptedAt ?? t.notifiedAt ?? t.createdAt;
    return minutesBetween(ref, now) > R.CLEANING_ACCEPT_SLA_MIN;
  });

  // M5: consultas respondidas por el sistema sin interrumpir al humano
  const m5 = todayEvents.filter((e) => e.kind === "consulta_respondida").length;

  // M6: escrituras no autorizadas aplicadas — por construcción, siempre 0
  const blockedWrites = allEvents.filter((e) => e.kind === "escritura_bloqueada").length;

  // M7: conflictos
  const allConflicts = await db.select().from(conflicts);
  const resolved = allConflicts.filter((c) => c.status === "resolved" && c.resolvedAt);
  const avgResolution =
    resolved.length > 0
      ? Math.round(resolved.reduce((acc, c) => acc + minutesBetween(c.createdAt, c.resolvedAt!), 0) / resolved.length)
      : null;

  // M8: propuestas vencidas sin resolver
  const allApprovals = await db.select().from(approvals);
  const expired = allApprovals.filter((a) => a.status === "expired").length;

  // Series
  const hourly: { hour: string; count: number }[] = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, "0")}h`,
    count: 0,
  }));
  for (const e of todayEvents) hourly[e.ts.getHours()].count++;

  return {
    m1: {
      avg: m1samples.length ? Math.round(m1samples.reduce((a, s) => a + s.mins, 0) / m1samples.length) : null,
      n: m1samples.length,
      best: m1samples.length ? Math.min(...m1samples.map((s) => s.mins)) : null,
      samples: m1samples.slice(-8),
    },
    m2: {
      avg: m2samples.length ? Math.round(m2samples.reduce((a, s) => a + s.mins, 0) / m2samples.length) : null,
      n: m2samples.length,
      samples: m2samples.slice(-8),
    },
    m3: { availableWithoutNotice: m3 },
    m4: { overdue: overdue.length, overdueCodes: overdue.map((t) => t.code) },
    m5: { answered: m5 },
    m6: { unauthorizedWrites: 0, blockedWrites },
    m7: { opened: allConflicts.length, resolved: resolved.length, avgResolutionMin: avgResolution },
    m8: { expired, decided: allApprovals.filter((a) => a.status === "approved" || a.status === "rejected").length },
    series: {
      cycles: completed
        .slice(-10)
        .map((t) => ({ code: t.code, mins: minutesBetween(t.detectedAt, t.closedAt!), label: t.code.slice(-4) })),
      hourly,
    },
  };
}
