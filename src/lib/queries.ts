/* ------------------------------------------------------------------ */
/*  LOADERS para las vistas — cada uno ejecuta el mantenimiento        */
/*  perezoso primero (vencimientos, escalados, datos vencidos)         */
/* ------------------------------------------------------------------ */

import { db } from "@/db";
import {
  approvals,
  beds,
  cleaningTasks,
  conflicts,
  establishments,
  events,
  messages,
  shiftReports,
  type Approval,
  type Bed,
  type CleaningTask,
  type Conflict,
  type Message,
  type OpsEvent,
  type ShiftReport,
} from "@/db/schema";
import { asc, desc, eq, gte, ne, and, sql } from "drizzle-orm";
import { ensureMaintenance } from "./engine";
import { getRules } from "./config";
import type { BedStatus } from "./domain";
import { addMinutes, minutesBetween } from "./time";

export type BedView = Bed & {
  estCode: string;
  estName: string;
  stale: boolean;
  effectiveStatus: BedStatus;
  openConflictId: number | null;
  activeTaskCode: string | null;
  activeTaskId: number | null;
  minutesInStatus: number;
  minutesSinceConfirm: number;
};

function decorate(
  b: Bed,
  estCode: string,
  estName: string,
  conflictMap: Map<number, number>,
  taskMap: Map<number, { code: string; id: number }>,
  now: Date,
  staleHours: number
): BedView {
  const staleLimit = addMinutes(now, -staleHours * 60);
  const stale = b.status !== "out_of_service" && b.lastConfirmedAt.getTime() < staleLimit.getTime();
  return {
    ...b,
    estCode,
    estName,
    stale,
    effectiveStatus: stale ? "stale" : (b.status as BedStatus),
    openConflictId: conflictMap.get(b.id) ?? null,
    activeTaskCode: taskMap.get(b.id)?.code ?? null,
    activeTaskId: taskMap.get(b.id)?.id ?? null,
    minutesInStatus: minutesBetween(b.statusSince, now),
    minutesSinceConfirm: minutesBetween(b.lastConfirmedAt, now),
  };
}

async function contextMaps() {
  const openConflicts = await db.select().from(conflicts).where(eq(conflicts.status, "open"));
  const activeTasks = await db
    .select()
    .from(cleaningTasks)
    .where(and(ne(cleaningTasks.status, "completed"), ne(cleaningTasks.status, "cancelled")));
  return {
    conflictMap: new Map(openConflicts.map((c) => [c.bedId, c.id] as const)),
    taskMap: new Map(activeTasks.map((t) => [t.bedId, { code: t.code, id: t.id }] as const)),
  };
}

export async function loadBeds(now = new Date()): Promise<{ beds: BedView[]; ests: { id: number; code: string; name: string; kind: string }[] }> {
  const R = await getRules();
  await ensureMaintenance(now);
  const ests = await db.select().from(establishments);
  const all = await db.select().from(beds).orderBy(asc(beds.code));
  const { conflictMap, taskMap } = await contextMaps();
  const estMap = new Map(ests.map((e) => [e.id, e]));
  return {
    beds: all.map((b) => {
      const e = estMap.get(b.establishmentId);
      return decorate(b, e?.code ?? "?", e?.name ?? "?", conflictMap, taskMap, now, R.STALE_AFTER_HOURS);
    }),
    ests,
  };
}

export type TaskView = CleaningTask & { bedCode: string; unit: string; estCode: string };
export type ApprovalView = Approval & { bedCode: string | null; taskCode: string | null; messageExternalId: string | null };
export type ConflictView = Conflict & { bedCode: string; unit: string; currentStatus: string };
export type EventView = OpsEvent & { bedCode: string | null };

function toTaskView(t: CleaningTask, bedMap: Map<number, Bed>, estMap: Map<number, { id: number; code: string; name: string; kind: string }>): TaskView {
  const b = bedMap.get(t.bedId);
  const e = b ? estMap.get(b.establishmentId) : undefined;
  return { ...t, bedCode: b?.code ?? "?", unit: b?.unit ?? "?", estCode: e?.code ?? "?" };
}

async function lookupMaps() {
  const allBeds = await db.select().from(beds);
  const allTasks = await db.select().from(cleaningTasks);
  const ests = await db.select().from(establishments);
  const allMessages = await db.select().from(messages);
  return {
    bedMap: new Map(allBeds.map((b) => [b.id, b] as const)),
    bedByCode: new Map(allBeds.map((b) => [b.code, b] as const)),
    taskMap: new Map(allTasks.map((t) => [t.id, t] as const)),
    taskByCode: new Map(allTasks.map((t) => [t.code, t] as const)),
    estMap: new Map(ests.map((e) => [e.id, e] as const)),
    msgMap: new Map(allMessages.map((m) => [m.id, m] as const)),
  };
}

function toApprovalView(a: Approval, maps: Awaited<ReturnType<typeof lookupMaps>>): ApprovalView {
  return {
    ...a,
    bedCode: a.bedId ? maps.bedMap.get(a.bedId)?.code ?? null : null,
    taskCode: a.taskId ? maps.taskMap.get(a.taskId)?.code ?? null : null,
    messageExternalId: a.messageId ? maps.msgMap.get(a.messageId)?.externalId ?? null : null,
  };
}

export async function loadCounts(now = new Date()) {
  await ensureMaintenance(now);
  const pendingApprovals = await db.select().from(approvals).where(eq(approvals.status, "pending"));
  const openConflicts = await db.select().from(conflicts).where(eq(conflicts.status, "open"));
  const activeTasks = await db
    .select()
    .from(cleaningTasks)
    .where(and(ne(cleaningTasks.status, "completed"), ne(cleaningTasks.status, "cancelled")));
  const escalated = activeTasks.filter((t) => t.priority !== "normal").length;
  const newMessages = await db.select().from(messages).where(eq(messages.status, "pendiente_datos"));
  return { pending: pendingApprovals.length, conflicts: openConflicts.length, escalated, pendDatos: newMessages.length };
}

export async function loadTasks(now = new Date()): Promise<{ active: TaskView[]; closed: TaskView[] }> {
  await ensureMaintenance(now);
  const all = await db.select().from(cleaningTasks).orderBy(desc(cleaningTasks.id));
  const maps = await lookupMaps();
  const view = (t: CleaningTask) => toTaskView(t, maps.bedMap, maps.estMap);
  const isActive = (t: CleaningTask) => !["completed", "cancelled"].includes(t.status);
  return { active: all.filter(isActive).map(view), closed: all.filter((t) => !isActive(t)).slice(0, 15).map(view) };
}

export async function loadApprovals(now = new Date()): Promise<{ pending: ApprovalView[]; recent: ApprovalView[] }> {
  await ensureMaintenance(now);
  const all = await db.select().from(approvals).orderBy(desc(approvals.id));
  const maps = await lookupMaps();
  const view = (a: Approval) => toApprovalView(a, maps);
  return {
    pending: all.filter((a) => a.status === "pending").map(view),
    recent: all.filter((a) => a.status !== "pending").slice(0, 14).map(view),
  };
}

export async function loadConflicts(now = new Date()): Promise<{ open: ConflictView[]; resolved: ConflictView[] }> {
  await ensureMaintenance(now);
  const all = await db.select().from(conflicts).orderBy(desc(conflicts.id));
  const maps = await lookupMaps();
  const view = (c: Conflict): ConflictView => {
    const b = maps.bedMap.get(c.bedId);
    return { ...c, bedCode: b?.code ?? "?", unit: b?.unit ?? "?", currentStatus: b?.status ?? "?" };
  };
  return {
    open: all.filter((c) => c.status === "open").map(view),
    resolved: all.filter((c) => c.status === "resolved").slice(0, 10).map(view),
  };
}

export async function loadMessages(now = new Date()): Promise<(Message & { bedCode: string | null; pendingApprovalCode: string | null })[]> {
  await ensureMaintenance(now);
  const msgs = await db.select().from(messages).orderBy(desc(messages.id)).limit(40);
  const maps = await lookupMaps();
  const pendingDrafts = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.status, "pending"), eq(approvals.kind, "reply_draft")));
  const draftByMsg = new Map(pendingDrafts.map((a) => [a.messageId, a.code] as const));
  return msgs.map((m) => ({
    ...m,
    bedCode: m.bedId ? maps.bedMap.get(m.bedId)?.code ?? null : null,
    pendingApprovalCode: draftByMsg.get(m.id) ?? null,
  }));
}

export async function loadEvents(now = new Date(), limitN = 150): Promise<{ events: EventView[] }> {
  await ensureMaintenance(now);
  const evs = await db.select().from(events).orderBy(desc(events.id)).limit(limitN);
  const maps = await lookupMaps();
  return { events: evs.map((e) => ({ ...e, bedCode: e.bedId ? maps.bedMap.get(e.bedId)?.code ?? null : null })) };
}

/* ---------------------- vistas de detalle ---------------------- */

export async function loadBedDetail(code: string, now = new Date()) {
  const R = await getRules();
  await ensureMaintenance(now);
  const maps = await lookupMaps();
  const bed = maps.bedByCode.get(code);
  if (!bed) return null;
  const { conflictMap, taskMap } = await contextMaps();
  const est = maps.estMap.get(bed.establishmentId);
  const view = decorate(bed, est?.code ?? "?", est?.name ?? "?", conflictMap, taskMap, now, R.STALE_AFTER_HOURS);

  const allTasks = await db.select().from(cleaningTasks).where(eq(cleaningTasks.bedId, bed.id)).orderBy(desc(cleaningTasks.id));
  const activeTask = allTasks.find((t) => !["completed", "cancelled"].includes(t.status)) ?? null;
  const closedTasks = allTasks.filter((t) => t !== activeTask).slice(0, 8);

  const bedApprovals = await db.select().from(approvals).where(eq(approvals.bedId, bed.id)).orderBy(desc(approvals.id));
  const bedConflicts = await db.select().from(conflicts).where(eq(conflicts.bedId, bed.id)).orderBy(desc(conflicts.id));
  const bedMessages = await db.select().from(messages).where(eq(messages.bedId, bed.id)).orderBy(desc(messages.id)).limit(8);
  const bedEvents = await db.select().from(events).where(eq(events.bedId, bed.id)).orderBy(desc(events.id)).limit(60);

  return {
    bed: view,
    est: est ?? null,
    staleHours: R.STALE_AFTER_HOURS,
    activeTask: activeTask ? toTaskView(activeTask, maps.bedMap, maps.estMap) : null,
    closedTasks: closedTasks.map((t) => toTaskView(t, maps.bedMap, maps.estMap)),
    pendingApprovals: bedApprovals.filter((a) => a.status === "pending").map((a) => toApprovalView(a, maps)),
    recentApprovals: bedApprovals.filter((a) => a.status !== "pending").slice(0, 6).map((a) => toApprovalView(a, maps)),
    openConflicts: bedConflicts.filter((c) => c.status === "open"),
    resolvedConflicts: bedConflicts.filter((c) => c.status === "resolved").slice(0, 4),
    messages: bedMessages,
    events: bedEvents.map((e) => ({ ...e, bedCode: bed.code })),
  };
}

export async function loadMessageDetail(id: number, now = new Date()) {
  await ensureMaintenance(now);
  const maps = await lookupMaps();
  const [msg] = await db.select().from(messages).where(eq(messages.id, id));
  if (!msg) return null;
  const bed = msg.bedId ? maps.bedMap.get(msg.bedId) ?? null : null;
  const est = bed ? maps.estMap.get(bed.establishmentId) ?? null : null;
  const msgApprovals = await db.select().from(approvals).where(eq(approvals.messageId, msg.id)).orderBy(desc(approvals.id));
  const replies = await db.select().from(messages).where(eq(messages.inReplyTo, msg.id)).orderBy(desc(messages.id));
  const parent = msg.inReplyTo ? maps.msgMap.get(msg.inReplyTo) ?? null : null;
  const msgEvents = await db
    .select()
    .from(events)
    .where(sql`${events.payload}->>'messageId' = ${String(msg.id)}`)
    .orderBy(desc(events.id))
    .limit(30);
  // contexto adicional: eventos de la cama vinculada cercanos
  const bedEvents = msg.bedId
    ? await db.select().from(events).where(eq(events.bedId, msg.bedId)).orderBy(desc(events.id)).limit(12)
    : [];
  return {
    msg,
    bed,
    est,
    approvals: msgApprovals.map((a) => toApprovalView(a, maps)),
    replies,
    parent,
    msgEvents: msgEvents.map((e) => ({ ...e, bedCode: bed?.code ?? null })),
    bedEvents: bedEvents.map((e) => ({ ...e, bedCode: bed?.code ?? null })),
  };
}

export async function loadTaskDetail(code: string, now = new Date()) {
  const R = await getRules();
  await ensureMaintenance(now);
  const maps = await lookupMaps();
  const task = maps.taskByCode.get(code);
  if (!task) return null;
  const bed = maps.bedMap.get(task.bedId) ?? null;
  const view = toTaskView(task, maps.bedMap, maps.estMap);
  const taskApprovals = await db.select().from(approvals).where(eq(approvals.taskId, task.id)).orderBy(desc(approvals.id));
  const taskEvents = await db.select().from(events).where(eq(events.taskId, task.id)).orderBy(desc(events.id)).limit(40);
  return {
    task: view,
    bed,
    staleHours: R.STALE_AFTER_HOURS,
    slaMin: R.CLEANING_ACCEPT_SLA_MIN,
    approvals: taskApprovals.map((a) => toApprovalView(a, maps)),
    events: taskEvents.map((e) => ({ ...e, bedCode: bed?.code ?? null })),
  };
}

export async function loadTurno(now = new Date(), horizon?: number) {
  const R = await getRules();
  const h = horizon ?? R.SHIFT_HORIZON_HOURS;
  await ensureMaintenance(now);
  const since = new Date(now.getTime() - h * 3600_000);
  const windowEvents = await db.select().from(events).where(gte(events.ts, since)).orderBy(desc(events.ts));
  const allTasks = await db.select().from(cleaningTasks);
  const allBeds = await db.select().from(beds);
  const ests = await db.select().from(establishments);
  const estMap = new Map(ests.map((e) => [e.id, e]));
  const bedMap = new Map(allBeds.map((b) => [b.id, b]));
  const completedInWindow = allTasks.filter(
    (t) => t.status === "completed" && t.closedAt && t.closedAt.getTime() >= since.getTime()
  );
  const activeTasks = allTasks.filter((t) => !["completed", "cancelled"].includes(t.status));
  const pendingApprovals = await db.select().from(approvals).where(eq(approvals.status, "pending"));
  const openConflicts = await db.select().from(conflicts).where(eq(conflicts.status, "open"));
  const reports = await db.select().from(shiftReports).orderBy(desc(shiftReports.id)).limit(8);
  const kindCount: Record<string, number> = {};
  for (const e of windowEvents) kindCount[e.kind] = (kindCount[e.kind] ?? 0) + 1;
  return {
    since,
    horizon: h,
    windowEvents: windowEvents.map((e) => ({ ...e, bedCode: e.bedId ? bedMap.get(e.bedId)?.code ?? null : null })),
    kindCount,
    completedInWindow: completedInWindow.map((t) => {
      const b = bedMap.get(t.bedId);
      const e = b ? estMap.get(b.establishmentId) : undefined;
      return {
        ...t,
        bedCode: b?.code ?? "?",
        unit: b?.unit ?? "?",
        estCode: e?.code ?? "?",
        m1: t.notifiedAt ? minutesBetween(t.detectedAt, t.notifiedAt) : null,
        cycle: t.closedAt ? minutesBetween(t.detectedAt, t.closedAt) : null,
      };
    }),
    inherited: {
      tasks: activeTasks.map((t) => ({ id: t.id, code: t.code, status: t.status, bedCode: bedMap.get(t.bedId)?.code ?? "?" })),
      approvals: pendingApprovals.map((a) => ({ code: a.code, title: a.title })),
      conflicts: openConflicts.map((c) => ({ id: c.id, bedCode: bedMap.get(c.bedId)?.code ?? "?" })),
    },
    reports: reports as ShiftReport[],
  };
}
