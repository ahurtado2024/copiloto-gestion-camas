import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/*  Esquema del Copiloto de Gestión de Camas — registro en paralelo    */
/*  Regla de diseño: sin datos clínicos ni de pacientes (R12).         */
/* ------------------------------------------------------------------ */

export const establishments = pgTable("establishments", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // hospital | sar | clinica
});

export const beds = pgTable(
  "beds",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(), // C-304
    establishmentId: integer("establishment_id")
      .notNull()
      .references(() => establishments.id),
    unit: text("unit").notNull(), // Medicina 3, UCI ...
    bedType: text("bed_type").notNull(), // basica | media | critica
    status: text("status").notNull().default("unknown"),
    statusSince: timestamp("status_since", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    // última confirmación HUMANA del dato — alimenta el cálculo de "stale"
    lastConfirmedAt: timestamp("last_confirmed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    note: text("note"),
  },
  (t) => [index("beds_status_idx").on(t.status), index("beds_est_idx").on(t.establishmentId)]
);

export const cleaningTasks = pgTable(
  "cleaning_tasks",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(), // LMP-20261012-0007
    bedId: integer("bed_id")
      .notNull()
      .references(() => beds.id),
    status: text("status").notNull().default("pending_notice"),
    priority: text("priority").notNull().default("normal"), // normal | alta | critica
    channel: text("channel").notNull().default("telegram"),
    detectedAt: timestamp("detected_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    notifiedAt: timestamp("notified_at", { withTimezone: true, mode: "date" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }), // aseo informó término
    inspectedAt: timestamp("inspected_at", { withTimezone: true, mode: "date" }), // validación humana
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
    cancelReason: text("cancel_reason"),
    blockedReason: text("blocked_reason"),
  },
  (t) => [index("tasks_status_idx").on(t.status), index("tasks_bed_idx").on(t.bedId)]
);

export const approvals = pgTable(
  "approvals",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(), // APR-0007
    kind: text("kind").notNull(), // discharge_confirmation | inspection_approval | reply_draft
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    bedId: integer("bed_id").references(() => beds.id),
    taskId: integer("task_id").references(() => cleaningTasks.id),
    messageId: integer("message_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("pending"), // pending|approved|rejected|expired|superseded
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true, mode: "date" }),
    decisionReason: text("decision_reason"),
    appliedAt: timestamp("applied_at", { withTimezone: true, mode: "date" }),
    outcomeNote: text("outcome_note"),
  },
  (t) => [index("approvals_status_idx").on(t.status)]
);

export const conflicts = pgTable(
  "conflicts",
  {
    id: serial("id").primaryKey(),
    bedId: integer("bed_id")
      .notNull()
      .references(() => beds.id),
    sourceA: text("source_a").notNull(),
    valueA: text("value_a").notNull(),
    sourceB: text("source_b").notNull(),
    valueB: text("value_b").notNull(),
    status: text("status").notNull().default("open"), // open | resolved
    resolution: text("resolution"),
    criterion: text("criterion"),
    resolvedBy: text("resolved_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [index("conflicts_status_idx").on(t.status)]
);

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    externalId: text("external_id").notNull().unique(), // idempotencia (R7)
    channel: text("channel").notNull(), // correo | telegram
    direction: text("direction").notNull().default("inbound"), // inbound | outbound
    fromName: text("from_name").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    classification: text("classification"), // alta | solicitud_cama | oferta | conflicto | administrativo | instruccion_sistema | duplicado
    extracted: jsonb("extracted").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("nuevo"), // nuevo|clasificado|vinculado|pendiente_datos|atendido|no_aplica|duplicado|enviado
    bedId: integer("bed_id").references(() => beds.id),
    inReplyTo: integer("in_reply_to"), // hilo: respuesta de qué mensaje
    handledBy: text("handled_by"),
    handledAt: timestamp("handled_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [index("messages_status_idx").on(t.status)]
);

/**
 * CAJA NEGRA (R6): registro append-only. Nunca se edita ni se borra.
 * dedupeKey garantiza idempotencia de efectos (R7).
 */
export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    dedupeKey: text("dedupe_key").unique(),
    ts: timestamp("ts", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    actor: text("actor").notNull(), // sistema | encargada | aseo | jefatura | externo
    source: text("source").notNull(), // correo | telegram | hoja | sistema | panel
    kind: text("kind").notNull(),
    bedId: integer("bed_id").references(() => beds.id),
    taskId: integer("task_id").references(() => cleaningTasks.id),
    approvalId: integer("approval_id").references(() => approvals.id),
    summary: text("summary").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index("events_ts_idx").on(t.ts), index("events_bed_idx").on(t.bedId), index("events_kind_idx").on(t.kind)]
);

export const shiftReports = pgTable("shift_reports", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  generatedBy: text("generated_by").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  horizonHours: integer("horizon_hours").notNull().default(12),
  content: jsonb("content").$type<Record<string, unknown>>().notNull().default({}),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("viewer"), // admin | encargada | aseo | jefatura | viewer
  establishmentId: integer("establishment_id").references(() => establishments.id),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: "date" }),
});

export type User = typeof users.$inferSelect;

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  organization: text("organization"), // Ej: Hospital Regional Rancagua
  role: text("role"), // Ej: Jefe de Turno, Admisión
  isPriority: integer("is_priority").notNull().default(0), // 1 = Prioritario, 0 = Normal
  notes: text("notes"),
  lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true, mode: "date" }),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/* Tipos derivados */
export type Bed = typeof beds.$inferSelect;
export type CleaningTask = typeof cleaningTasks.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type Conflict = typeof conflicts.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type OpsEvent = typeof events.$inferSelect;
export type Establishment = typeof establishments.$inferSelect;
export type ShiftReport = typeof shiftReports.$inferSelect;
