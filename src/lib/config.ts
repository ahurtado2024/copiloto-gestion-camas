/* ------------------------------------------------------------------ */
/*  CONFIGURACIÓN EN CALIENTE — umbrales operativos editables          */
/*  (los leídos por el motor en cada operación; defaults en domain.ts) */
/* ------------------------------------------------------------------ */

import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { RULES } from "./domain";

export type RuntimeRules = {
  DISCHARGE_APPROVAL_TTL_MIN: number;
  INSPECTION_APPROVAL_TTL_MIN: number;
  CLEANING_ACCEPT_SLA_MIN: number;
  STALE_AFTER_HOURS: number;
  SHIFT_HORIZON_HOURS: number;
  CANAL_ASEO: string;
  TURNO_ACTOR: string;
};

export const SETTING_DEFS: {
  key: string;
  ruleKey: keyof RuntimeRules;
  label: string;
  hint: string;
  unit?: string;
  min?: number;
  max?: number;
  numeric: boolean;
  options?: { value: string; label: string }[];
}[] = [
  { key: "sla_limpieza_min", ruleKey: "CLEANING_ACCEPT_SLA_MIN", label: "SLA de aceptación de aseo", hint: "minutos sin que aseo tome el aviso antes de escalar (alta → crítica al doble)", unit: "min", min: 5, max: 720, numeric: true },
  { key: "frescura_horas", ruleKey: "STALE_AFTER_HOURS", label: "Frescura del dato de cama", hint: "horas sin confirmación humana antes de marcar el dato como vencido (R8)", unit: "h", min: 1, max: 48, numeric: true },
  { key: "ttl_alta_min", ruleKey: "DISCHARGE_APPROVAL_TTL_MIN", label: "Vigencia de propuesta de alta", hint: "si nadie confirma en este plazo, la propuesta caduca y la cama no se mueve", unit: "min", min: 5, max: 240, numeric: true },
  { key: "ttl_inspeccion_min", ruleKey: "INSPECTION_APPROVAL_TTL_MIN", label: "Vigencia de propuesta de inspección", hint: "plazo para que el humano valide antes de que la propuesta caduque", unit: "min", min: 10, max: 1440, numeric: true },
  { key: "horizonte_turno_h", ruleKey: "SHIFT_HORIZON_HOURS", label: "Horizonte del informe de turno", hint: "horas hacia atrás que cubre el cierre de turno", unit: "h", min: 4, max: 24, numeric: true },
  { key: "canal_aseo", ruleKey: "CANAL_ASEO", label: "Canal de aviso a limpieza", hint: "por dónde sale el aviso al equipo de aseo hoy", numeric: false, options: [
    { value: "telegram", label: "Telegram del turno" },
    { value: "whatsapp", label: "WhatsApp del turno" },
    { value: "correo", label: "Correo institucional" },
  ] },
  { key: "turno_actor", ruleKey: "TURNO_ACTOR", label: "Identidad del turno", hint: "nombre con el que firmas tus autorizaciones en la caja negra", numeric: false },
];

export async function getRules(): Promise<RuntimeRules> {
  const rows = await db.select().from(settings);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const num = (k: string, d: number) => {
    const v = map.get(k);
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : d;
  };
  return {
    DISCHARGE_APPROVAL_TTL_MIN: num("ttl_alta_min", RULES.DISCHARGE_APPROVAL_TTL_MIN),
    INSPECTION_APPROVAL_TTL_MIN: num("ttl_inspeccion_min", RULES.INSPECTION_APPROVAL_TTL_MIN),
    CLEANING_ACCEPT_SLA_MIN: num("sla_limpieza_min", RULES.CLEANING_ACCEPT_SLA_MIN),
    STALE_AFTER_HOURS: num("frescura_horas", RULES.STALE_AFTER_HOURS),
    SHIFT_HORIZON_HOURS: num("horizonte_turno_h", RULES.SHIFT_HORIZON_HOURS),
    CANAL_ASEO: map.get("canal_aseo") ?? "telegram",
    TURNO_ACTOR: map.get("turno_actor") ?? "M. Rojas",
  };
}

export async function setSetting(key: string, value: string) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export function validateSetting(key: string, value: string): { ok: boolean; value?: string; message?: string } {
  const def = SETTING_DEFS.find((d) => d.key === key);
  if (!def) return { ok: false, message: `Clave desconocida: ${key}` };
  if (def.numeric) {
    const n = Number(value);
    if (!Number.isFinite(n)) return { ok: false, message: `"${def.label}" espera un número.` };
    if (def.min !== undefined && n < def.min) return { ok: false, message: `"${def.label}" no puede ser menor que ${def.min}.` };
    if (def.max !== undefined && n > def.max) return { ok: false, message: `"${def.label}" no puede superar ${def.max}.` };
    return { ok: true, value: String(Math.round(n)) };
  }
  if (def.options && !def.options.some((o) => o.value === value))
    return { ok: false, message: `Valor no permitido para "${def.label}".` };
  if (!def.options && (value.trim().length < 2 || value.trim().length > 40))
    return { ok: false, message: `"${def.label}" debe tener entre 2 y 40 caracteres.` };
  return { ok: true, value: value.trim() };
}
