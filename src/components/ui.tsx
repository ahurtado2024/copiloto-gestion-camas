import type { ReactNode } from "react";
import { BED_STATE_META, TASK_STATE_META, type BedStatus, type TaskStatus, EVENT_KIND_TONE } from "@/lib/domain";
import { ago, hhmm, duration } from "@/lib/time";

/* ---- page header ---- */
export function PageHeader({ kicker, title, desc, actions }: { kicker: string; title: string; desc: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="rise">
        <div className="mono text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--color-text-muted)]">{kicker}</div>
        <h1 className="mt-1 text-[24px] font-bold leading-tight tracking-tight text-[var(--color-text)] md:text-[28px]">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{desc}</p>
      </div>
      {actions && <div className="rise rise-1 flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---- layout ---- */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`panel ${className}`}>{children}</div>;
}

export function PanelTitle({ icon, title, sub, right }: { icon?: ReactNode; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] px-4 py-3">
      {icon && <span className="text-[var(--color-text-muted)]">{icon}</span>}
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-[var(--color-text)]">{title}</div>
        {sub && <div className="truncate text-[11px] text-[var(--color-text-muted)]">{sub}</div>}
      </div>
      {right && <div className="ml-auto flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface)] text-[var(--color-text-muted)]">{icon}</div>
      <div className="text-[13px] font-semibold text-[var(--color-text)]">{title}</div>
      <div className="max-w-xs text-[11px] leading-relaxed text-[var(--color-text-muted)]">{desc}</div>
    </div>
  );
}

/* ---- badges — pill style like reference ---- */

/* Light-theme bed state meta — colored backgrounds */
const LT_BED: Record<BedStatus, { label: string; short: string; hint: string; dot: string; pill: string }> = {
  occupied:            { label: "Ocupada",              short: "Ocupada",          hint: "Sin acción pendiente",                      dot: "bg-slate-400",   pill: "bg-slate-100 text-slate-700" },
  discharge_detected:  { label: "Alta detectada",       short: "Alta detectada",   hint: "Parece que se liberó — no es afirmación",  dot: "bg-violet-500",  pill: "bg-violet-50 text-violet-700" },
  pending_cleaning:    { label: "Pendiente de limpieza",short: "Pend. limpieza",   hint: "Alta confirmada — falta que aseo se mueva",dot: "bg-amber-500",   pill: "bg-amber-50 text-amber-700" },
  cleaning:            { label: "En limpieza",          short: "En limpieza",      hint: "Trabajo de aseo en curso",                 dot: "bg-sky-500",     pill: "bg-sky-50 text-sky-700" },
  cleaning_completed:  { label: "Limpieza terminada",   short: "Limp. terminada",  hint: "Informado por aseo — no validado",         dot: "bg-cyan-500",    pill: "bg-cyan-50 text-cyan-700" },
  pending_inspection:  { label: "Pendiente inspección", short: "Pend. inspección", hint: "Falta la revisión humana",                 dot: "bg-orange-500",  pill: "bg-orange-50 text-orange-700" },
  available:           { label: "Disponible",           short: "Disponible",       hint: "Promesa válida para ofrecer la cama",       dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700" },
  reserved:            { label: "Reservada",            short: "Reservada",        hint: "Comprometida con una solicitud",            dot: "bg-teal-500",    pill: "bg-teal-50 text-teal-700" },
  blocked:             { label: "Bloqueada",            short: "Bloqueada",        hint: "No usable por un motivo temporal",          dot: "bg-rose-500",    pill: "bg-red-50 text-red-700" },
  out_of_service:      { label: "Fuera de servicio",    short: "Fuera de servicio",hint: "Baja por mantención / remodelación",        dot: "bg-zinc-400",    pill: "bg-zinc-100 text-zinc-600" },
  unknown:             { label: "Desconocido",          short: "Desconocido",      hint: "Nadie sabe — es un pendiente, no un neutro",dot: "bg-fuchsia-500", pill: "bg-fuchsia-50 text-fuchsia-700" },
  stale:               { label: "Dato vencido",         short: "Vencido",          hint: "La información perdió validez por tiempo",  dot: "bg-yellow-500",  pill: "bg-yellow-50 text-yellow-700" },
};

export function BedStateBadge({ status, stale = false, size = "md" }: { status: BedStatus; stale?: boolean; size?: "sm" | "md" }) {
  const meta = LT_BED[stale ? "stale" : status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${meta.pill} ${size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${status === "discharge_detected" || stale ? "dot-blink" : ""}`} />
      {stale ? `Vencido` : meta.short}
    </span>
  );
}

const LT_TASK: Record<TaskStatus, { label: string; dot: string; pill: string }> = {
  pending_notice:     { label: "Aviso pendiente",   dot: "bg-amber-500",   pill: "bg-amber-50 text-amber-700" },
  notified:           { label: "Aviso enviado",     dot: "bg-sky-500",     pill: "bg-sky-50 text-sky-700" },
  accepted:           { label: "Tomada por aseo",   dot: "bg-sky-500",     pill: "bg-sky-50 text-sky-700" },
  cleaning:           { label: "En limpieza",       dot: "bg-cyan-500",    pill: "bg-cyan-50 text-cyan-700" },
  cleaning_completed: { label: "Término informado", dot: "bg-orange-500",  pill: "bg-orange-50 text-orange-700" },
  pending_inspection: { label: "Pend. inspección",  dot: "bg-orange-500",  pill: "bg-orange-50 text-orange-700" },
  completed:          { label: "Ciclo completado",  dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700" },
  cancelled:          { label: "Anulada",           dot: "bg-zinc-400",    pill: "bg-zinc-100 text-zinc-600" },
  blocked:            { label: "Con impedimento",   dot: "bg-rose-500",    pill: "bg-red-50 text-red-700" },
};

export function TaskStateBadge({ status }: { status: TaskStatus }) {
  const meta = LT_TASK[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${meta.pill} px-2.5 py-1 text-[11px]`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
    </span>
  );
}

export function PriorityChip({ priority }: { priority: string }) {
  if (priority === "normal") return null;
  const map: Record<string, string> = {
    alta: "bg-amber-50 text-amber-700",
    critica: "bg-red-50 text-red-700 dot-blink",
  };
  return (
    <span className={`mono inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${map[priority] ?? ""}`}>
      {priority === "critica" && <span className="h-1.5 w-1.5 rounded-full bg-red-500 dot-blink" />}
      {priority}
    </span>
  );
}

export function ApprovalStatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:    { label: "Esperándote", cls: "bg-violet-50 text-violet-700" },
    approved:   { label: "Aprobada",    cls: "bg-emerald-50 text-emerald-700" },
    rejected:   { label: "Rechazada",   cls: "bg-slate-100 text-slate-600" },
    expired:    { label: "Vencida",     cls: "bg-amber-50 text-amber-700" },
    superseded: { label: "Obsoleta",    cls: "bg-orange-50 text-orange-700" },
  };
  const m = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-600" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${m.cls}`}>{m.label}</span>;
}

export function ApprovalKindChip({ kind, label }: { kind: string; label: string }) {
  const map: Record<string, string> = {
    discharge_confirmation: "bg-violet-50 text-violet-700",
    inspection_approval:    "bg-orange-50 text-orange-700",
    reply_draft:            "bg-sky-50 text-sky-700",
  };
  return <span className={`mono inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[kind] ?? "bg-slate-100 text-slate-600"}`}>{label}</span>;
}

/* ---- KPI stat — colored backgrounds like reference ---- */

const statTones: Record<string, { bg: string; text: string; sub: string }> = {
  default: { bg: "bg-white border border-[var(--color-border)]", text: "text-[var(--color-text)]", sub: "text-[var(--color-text-muted)]" },
  ok:      { bg: "bg-emerald-50 border border-emerald-200", text: "text-emerald-700", sub: "text-emerald-600/70" },
  warn:    { bg: "bg-amber-50 border border-amber-200", text: "text-amber-700", sub: "text-amber-600/70" },
  danger:  { bg: "bg-red-50 border border-red-200", text: "text-red-700", sub: "text-red-600/70" },
  violet:  { bg: "bg-violet-50 border border-violet-200", text: "text-violet-700", sub: "text-violet-600/70" },
};

export function Stat({ label, value, sub, tone = "default", icon }: { label: string; value: string; sub?: string; tone?: "default" | "ok" | "warn" | "danger" | "violet"; icon?: ReactNode }) {
  const t = statTones[tone];
  return (
    <div className={`rounded-xl px-4 py-3.5 ${t.bg}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{label}</div>
        {icon && <span className={t.sub}>{icon}</span>}
      </div>
      <div className={`mt-1 text-[24px] font-bold leading-none tabular-nums ${t.text}`}>{value}</div>
      {sub && <div className={`mt-1.5 text-[10.5px] leading-snug ${t.sub}`}>{sub}</div>}
    </div>
  );
}

/* ---- pipeline ---- */
export function TaskPipeline({ status }: { status: TaskStatus }) {
  const steps = [
    { key: "notified" as const, label: "aviso" },
    { key: "accepted" as const, label: "tomada" },
    { key: "cleaning" as const, label: "limpieza" },
    { key: "pending_inspection" as const, label: "inspección" },
    { key: "completed" as const, label: "lista" },
  ];
  if (status === "cancelled" || status === "blocked") {
    return <div className="mono text-[10px] text-[var(--color-text-muted)]">{status === "cancelled" ? "— ciclo anulado —" : "⏸ impedimento"}</div>;
  }
  const order: Record<string, number> = { pending_notice: 0, notified: 1, accepted: 2, cleaning: 3, cleaning_completed: 3.5, pending_inspection: 4, completed: 5 };
  const cur = order[status] ?? 0;
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => {
        const stepN = i + 1;
        const done = cur >= stepN;
        const active = Math.ceil(cur) === stepN && cur < 5;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div className="flex flex-col items-center">
              <div className={`h-1.5 w-8 rounded-full transition ${done ? "bg-emerald-500" : active ? "bg-emerald-300" : "bg-gray-200"}`} />
              <div className={`mono mt-1 text-[8.5px] uppercase tracking-wide ${done || active ? "text-emerald-700" : "text-[var(--color-text-muted)]"}`}>{s.label}</div>
            </div>
            {i < steps.length - 1 && <div className="mb-3.5 h-px w-1.5 bg-gray-200" />}
          </div>
        );
      })}
    </div>
  );
}

/* ---- bars ---- */
export function Bars({ data, max, unit = "", tone = "emerald" }: { data: { label: string; value: number }[]; max?: number; unit?: string; tone?: "emerald" | "sky" | "violet" }) {
  const m = max ?? Math.max(1, ...data.map((d) => d.value));
  const fill = tone === "emerald" ? "#16a34a" : tone === "sky" ? "#0284c7" : "#7c3aed";
  return (
    <div className="flex items-end gap-1.5">
      {data.map((d, i) => (
        <div key={i} className="group flex flex-1 flex-col items-center gap-1">
          <div className="mono text-[8.5px] text-[var(--color-text-muted)] opacity-0 transition group-hover:opacity-100">{d.value}{unit}</div>
          <div className="flex h-20 w-full items-end">
            <div className="w-full rounded-t-[3px] transition-all group-hover:opacity-100"
              style={{ height: `${Math.max(3, (d.value / m) * 100)}%`, background: fill, opacity: d.value === 0 ? 0.12 : 0.65 }} />
          </div>
          <div className="mono text-[8.5px] text-[var(--color-text-muted)]">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ---- time / event ---- */
export function TimeMark({ at, now }: { at: Date | null; now: Date }) {
  if (!at) return <span className="text-[var(--color-text-muted)]">—</span>;
  return <span className="mono text-[10.5px] text-[var(--color-text-secondary)]">{hhmm(at)} <span className="text-[var(--color-text-muted)]">· {ago(at, now)}</span></span>;
}

export function EventDot({ kind }: { kind: string }) {
  const tone = EVENT_KIND_TONE[kind];
  const cls = tone === "danger" ? "bg-red-500" : tone === "warn" ? "bg-amber-500" : tone === "ok" ? "bg-emerald-500" : "bg-slate-300";
  return <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${cls} ${tone === "danger" ? "dot-blink" : ""}`} />;
}

export function dur(mins: number | null | undefined) { return duration(mins); }
