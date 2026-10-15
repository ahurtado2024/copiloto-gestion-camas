/* ------------------------------------------------------------------ */
/*  Idioma del negocio: catálogos compartidos (sección 9 del handoff)  */
/* ------------------------------------------------------------------ */

export type BedStatus =
  | "occupied"
  | "discharge_detected"
  | "pending_cleaning"
  | "cleaning"
  | "cleaning_completed"
  | "pending_inspection"
  | "available"
  | "reserved"
  | "blocked"
  | "out_of_service"
  | "unknown"
  | "stale";

export const BED_STATUSES: BedStatus[] = [
  "occupied",
  "discharge_detected",
  "pending_cleaning",
  "cleaning",
  "cleaning_completed",
  "pending_inspection",
  "available",
  "reserved",
  "blocked",
  "out_of_service",
  "unknown",
  "stale",
];

type StateMeta = {
  label: string;
  short: string;
  hint: string;
  dot: string;
  text: string;
  ring: string;
  bg: string;
};

export const BED_STATE_META: Record<BedStatus, StateMeta> = {
  occupied: {
    label: "Ocupada",
    short: "Ocupada",
    hint: "Sin acción pendiente",
    dot: "bg-slate-400",
    text: "text-slate-300",
    ring: "ring-slate-500/40",
    bg: "bg-slate-500/10",
  },
  discharge_detected: {
    label: "Alta detectada",
    short: "Alta detectada",
    hint: "Parece que se liberó — no es afirmación",
    dot: "bg-violet-400",
    text: "text-violet-300",
    ring: "ring-violet-500/40",
    bg: "bg-violet-500/10",
  },
  pending_cleaning: {
    label: "Pendiente de limpieza",
    short: "Pend. limpieza",
    hint: "Alta confirmada — falta que aseo se mueva",
    dot: "bg-amber-400",
    text: "text-amber-300",
    ring: "ring-amber-500/40",
    bg: "bg-amber-500/10",
  },
  cleaning: {
    label: "En limpieza",
    short: "En limpieza",
    hint: "Trabajo de aseo en curso",
    dot: "bg-sky-400",
    text: "text-sky-300",
    ring: "ring-sky-500/40",
    bg: "bg-sky-500/10",
  },
  cleaning_completed: {
    label: "Limpieza terminada",
    short: "Limp. terminada",
    hint: "Informado por aseo — no validado",
    dot: "bg-cyan-300",
    text: "text-cyan-200",
    ring: "ring-cyan-400/40",
    bg: "bg-cyan-500/10",
  },
  pending_inspection: {
    label: "Pendiente de inspección",
    short: "Pend. inspección",
    hint: "Falta la revisión humana (ropa, baño, insumos)",
    dot: "bg-orange-400",
    text: "text-orange-300",
    ring: "ring-orange-500/40",
    bg: "bg-orange-500/10",
  },
  available: {
    label: "Disponible",
    short: "Disponible",
    hint: "Promesa válida para ofrecer la cama",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    ring: "ring-emerald-500/40",
    bg: "bg-emerald-500/10",
  },
  reserved: {
    label: "Reservada",
    short: "Reservada",
    hint: "Comprometida con una solicitud",
    dot: "bg-teal-300",
    text: "text-teal-200",
    ring: "ring-teal-400/40",
    bg: "bg-teal-500/10",
  },
  blocked: {
    label: "Bloqueada",
    short: "Bloqueada",
    hint: "No usable por un motivo temporal",
    dot: "bg-rose-400",
    text: "text-rose-300",
    ring: "ring-rose-500/40",
    bg: "bg-rose-500/10",
  },
  out_of_service: {
    label: "Fuera de servicio",
    short: "Fuera de servicio",
    hint: "Baja por mantención / remodelación",
    dot: "bg-zinc-500",
    text: "text-zinc-400",
    ring: "ring-zinc-500/40",
    bg: "bg-zinc-500/10",
  },
  unknown: {
    label: "Desconocido",
    short: "Desconocido",
    hint: "Nadie sabe — es un pendiente, no un neutro",
    dot: "bg-fuchsia-400",
    text: "text-fuchsia-300",
    ring: "ring-fuchsia-500/40",
    bg: "bg-fuchsia-500/10",
  },
  stale: {
    label: "Dato vencido",
    short: "Vencido",
    hint: "La información perdió validez por tiempo",
    dot: "bg-yellow-500",
    text: "text-yellow-300",
    ring: "ring-yellow-500/40",
    bg: "bg-yellow-500/10",
  },
};

/* -------------------- Tareas de limpieza -------------------- */

export type TaskStatus =
  | "pending_notice"
  | "notified"
  | "accepted"
  | "cleaning"
  | "cleaning_completed"
  | "pending_inspection"
  | "completed"
  | "cancelled"
  | "blocked";

export const TASK_STATE_META: Record<TaskStatus, { label: string; step: number; dot: string; text: string }> = {
  pending_notice: { label: "Aviso pendiente", step: 1, dot: "bg-amber-400", text: "text-amber-300" },
  notified: { label: "Aviso enviado", step: 2, dot: "bg-sky-400", text: "text-sky-300" },
  accepted: { label: "Tomada por aseo", step: 3, dot: "bg-sky-300", text: "text-sky-200" },
  cleaning: { label: "En limpieza", step: 4, dot: "bg-cyan-300", text: "text-cyan-200" },
  cleaning_completed: { label: "Término informado", step: 5, dot: "bg-orange-300", text: "text-orange-200" },
  pending_inspection: { label: "Pendiente de inspección", step: 6, dot: "bg-orange-400", text: "text-orange-300" },
  completed: { label: "Ciclo completado", step: 7, dot: "bg-emerald-400", text: "text-emerald-300" },
  cancelled: { label: "Anulada", step: 0, dot: "bg-zinc-500", text: "text-zinc-400" },
  blocked: { label: "Con impedimento", step: -1, dot: "bg-rose-400", text: "text-rose-300" },
};

export const TASK_FLOW: TaskStatus[] = [
  "pending_notice",
  "notified",
  "accepted",
  "cleaning",
  "cleaning_completed",
  "pending_inspection",
  "completed",
];

/* -------------------- Clasificación de mensajes -------------------- */

export const MESSAGE_CLASSIFICATIONS: Record<string, { label: string; text: string; dot: string }> = {
  alta: { label: "Aviso de alta", text: "text-violet-300", dot: "bg-violet-400" },
  solicitud_cama: { label: "Solicitud de cama", text: "text-sky-300", dot: "bg-sky-400" },
  oferta: { label: "Oferta de cama", text: "text-emerald-300", dot: "bg-emerald-400" },
  confirmacion: { label: "Confirmación", text: "text-teal-300", dot: "bg-teal-400" },
  conflicto: { label: "Contradicción", text: "text-rose-300", dot: "bg-rose-400" },
  administrativo: { label: "Administrativo", text: "text-zinc-300", dot: "bg-zinc-400" },
  instruccion_sistema: { label: "Instrucción al sistema", text: "text-fuchsia-300", dot: "bg-fuchsia-400" },
  duplicado: { label: "Duplicado", text: "text-zinc-400", dot: "bg-zinc-500" },
};

export const MESSAGE_STATUS: Record<string, string> = {
  nuevo: "Nuevo",
  clasificado: "Clasificado",
  vinculado: "Vinculado",
  pendiente_datos: "Espera datos",
  atendido: "Atendido",
  no_aplica: "No aplica",
  duplicado: "Duplicado (ignorado)",
  enviado: "Enviado",
};

/* -------------------- Reglas parametrizadas -------------------- */

export const RULES = {
  /** TTL de propuestas de alta (min) */
  DISCHARGE_APPROVAL_TTL_MIN: 30,
  /** TTL de aprobación de inspección (min) */
  INSPECTION_APPROVAL_TTL_MIN: 90,
  /** SLA de aceptación del aviso a aseo (min) */
  CLEANING_ACCEPT_SLA_MIN: 60,
  /** Frescura del dato de cama (horas) — después es "stale" (R8) */
  STALE_AFTER_HOURS: 4,
  /** Ventana por defecto del informe de turno (horas) */
  SHIFT_HORIZON_HOURS: 12,
} as const;

export const APPROVAL_KIND_LABEL: Record<string, string> = {
  discharge_confirmation: "Confirmación de alta",
  inspection_approval: "Validación de inspección",
  reply_draft: "Respuesta de correo",
};

export const BED_TYPE_LABEL: Record<string, string> = {
  basica: "Básica",
  media: "Media",
  critica: "Crítica",
  aislamiento: "Aislamiento",
};

export const EVENT_KIND_LABEL: Record<string, string> = {
  correo_recibido: "Correo recibido",
  correo_clasificado: "Correo clasificado",
  mensaje_duplicado: "Duplicado detectado",
  instruccion_externa_bloqueada: "Instrucción externa bloqueada",
  alta_detectada: "Alta detectada",
  alta_confirmada: "Alta confirmada",
  alta_rechazada: "Alta descartada",
  limpieza_creada: "Tarea de limpieza creada",
  limpieza_notificada: "Aviso enviado a aseo",
  limpieza_aceptada: "Aseo tomó el trabajo",
  limpieza_iniciada: "Limpieza iniciada",
  limpieza_terminada: "Aseo informó término",
  limpieza_bloqueada: "Impedimento informado",
  limpieza_anulada: "Tarea anulada",
  limpieza_escalada: "Seguimiento escalado",
  inspeccion_propuesta: "Inspección propuesta",
  inspeccion_aprobada: "Inspección aprobada",
  inspeccion_rechazada: "Inspección rechazada",
  cama_disponible: "Cama disponible",
  cama_reservada: "Cama reservada",
  reserva_liberada: "Reserva liberada",
  cama_bloqueada: "Cama bloqueada",
  cama_fuera_servicio: "Fuera de servicio",
  cama_reincorporada: "Reincorporada",
  dato_reconfirmado: "Dato reconfirmado",
  dato_vencido: "Dato vencido",
  conflicto_abierto: "Conflicto detectado",
  conflicto_resuelto: "Conflicto resuelto",
  aprobacion_aplicada: "Propuesta aplicada",
  aprobacion_rechazada: "Propuesta rechazada",
  aprobacion_vencida: "Propuesta vencida",
  aprobacion_obsoleta: "Propuesta obsoleta",
  respuesta_enviada: "Respuesta enviada",
  consulta_respondida: "Consulta respondida",
  escritura_bloqueada: "Escritura bloqueada",
  turno_cerrado: "Turno cerrado",
  borrador_preparado: "Borrador preparado",
  config_actualizada: "Configuración actualizada",
  bootstrap: "Sistema inicializado",
};

export const EVENT_KIND_TONE: Record<string, string> = {
  instruccion_externa_bloqueada: "danger",
  escritura_bloqueada: "danger",
  conflicto_abierto: "warn",
  aprobacion_vencida: "warn",
  dato_vencido: "warn",
  limpieza_escalada: "warn",
  cama_disponible: "ok",
  inspeccion_aprobada: "ok",
  conflicto_resuelto: "ok",
  alta_confirmada: "ok",
};
