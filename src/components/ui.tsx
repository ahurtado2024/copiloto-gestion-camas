import type { ReactNode } from "react";
import { BED_STATE_META, TASK_STATE_META, type BedStatus, type TaskStatus, EVENT_KIND_TONE } from "@/lib/domain";
import { ago, hhmm, duration } from "@/lib/time";

/* ---- Page Header Mejorado ---- */
export function PageHeader({ kicker, title, desc, actions }: { kicker: string; title: string; desc: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-6 px-1">
      <div className="rise">
        <div className="mono text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600 mb-1">{kicker}</div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-gray-900 md:text-[34px]">{title}</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-gray-600 font-medium">{desc}</p>
      </div>
      {actions && <div className="rise rise-1 flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

/* ---- Layout Primitives ---- */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`panel ${className}`}>{children}</div>;
}

export function PanelTitle({ icon, title, sub, right }: { icon?: ReactNode; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
      {icon && <span className="text-gray-500">{icon}</span>}
      <div className="min-w-0">
        <div className="truncate text-[15px] font-bold text-gray-900">{title}</div>
        {sub && <div className="truncate text-[13px] font-semibold text-gray-500">{sub}</div>}
      </div>
      {right && <div className="ml-auto flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-500 border border-gray-100">{icon}</div>
      <div className="text-[16px] font-bold text-gray-800">{title}</div>
      <div className="max-w-xs text-[13px] leading-relaxed text-gray-600 font-medium">{desc}</div>
    </div>
  );
}

/* ---- Badges de Alto Contraste ---- */
const LT_BED_REFINED: Record<BedStatus, { dot: string; pill: string; label: string }> = {
  occupied:            { dot: "bg-slate-400",   pill: "bg-slate-100 text-slate-700",   label: "Ocupada" },
  discharge_detected:  { dot: "bg-violet-600",  pill: "bg-violet-100 text-violet-700",  label: "Alta Detectada" },
  pending_cleaning:    { dot: "bg-amber-600",   pill: "bg-amber-100 text-amber-800",   label: "Pend. Limpieza" },
  cleaning:            { dot: "bg-sky-600",     pill: "bg-sky-100 text-sky-800",     label: "En Limpieza" },
  cleaning_completed:  { dot: "bg-cyan-600",    pill: "bg-cyan-100 text-cyan-800",    label: "Limp. Terminada" },
  pending_inspection:  { dot: "bg-orange-600",  pill: "bg-orange-100 text-orange-800", label: "Pend. Inspección" },
  available:           { dot: "bg-emerald-600", pill: "bg-emerald-100 text-emerald-800",label: "Disponible" },
  reserved:            { dot: "bg-teal-600",    pill: "bg-teal-100 text-teal-800",    label: "Reservada" },
  blocked:             { dot: "bg-red-600",     pill: "bg-red-100 text-red-800",       label: "Bloqueada" },
  out_of_service:      { dot: "bg-zinc-600",    pill: "bg-zinc-100 text-zinc-700",    label: "F. Servicio" },
  unknown:             { dot: "bg-fuchsia-600", pill: "bg-fuchsia-100 text-fuchsia-800",label: "Desconocido" },
  stale:               { dot: "bg-yellow-600",  pill: "bg-yellow-100 text-yellow-800", label: "Dato Vencido" },
};

export function BedStateBadge({ status, stale = false, size = "md" }: { status: BedStatus; stale?: boolean; size?: "sm" | "md" }) {
  const meta = LT_BED_REFINED[stale ? "stale" : status];
  return (
    <span className={`pill ${meta.pill} ${size === "sm" ? "px-2 py-0.5" : "px-3 py-1"}`}>
      <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${meta.dot} ${status === "discharge_detected" || stale ? "animate-pulse" : ""}`} />
      {stale ? `Vencido` : meta.label}
    </span>
  );
}

export function ApprovalStatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:    { label: "Esperándote", cls: "bg-violet-100 text-violet-700" },
    approved:   { label: "Aprobada",    cls: "bg-emerald-100 text-emerald-800" },
    rejected:   { label: "Rechazada",   cls: "bg-gray-100 text-gray-700" },
    expired:    { label: "Vencida",     cls: "bg-amber-100 text-amber-800" },
    superseded: { label: "Obsoleta",    cls: "bg-orange-100 text-orange-800" },
  };
  const m = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" };
  return <span className={`pill ${m.cls}`}>{m.label}</span>;
}

export function ApprovalKindChip({ kind, label }: { kind: string; label: string }) {
  const map: Record<string, string> = {
    discharge_confirmation: "bg-violet-100 text-violet-700",
    inspection_approval:    "bg-orange-100 text-orange-800",
    reply_draft:            "bg-sky-100 text-sky-800",
  };
  return <span className={`pill ${map[kind] ?? "bg-gray-100 text-gray-700"}`}>{label}</span>;
}

/* ---- KPI Stat Cards con Colores de Referencia ---- */
const statTones: Record<string, { bg: string; text: string; sub: string; border: string }> = {
  default: { bg: "bg-white", border: "border-gray-200", text: "text-gray-900", sub: "text-gray-500" },
  ok:      { bg: "bg-emerald-50/50", border: "border-emerald-200", text: "text-emerald-800", sub: "text-emerald-600" },
  warn:    { bg: "bg-amber-50/50", border: "border-amber-200", text: "text-amber-800", sub: "text-amber-600" },
  danger:  { bg: "bg-red-50/50", border: "border-red-200", text: "text-red-800", sub: "text-red-600" },
  violet:  { bg: "bg-violet-50/50", border: "border-violet-200", text: "text-violet-800", sub: "text-violet-600" },
};

export function Stat({ label, value, sub, tone = "default", icon }: { label: string; value: string; sub?: string; tone?: "default" | "ok" | "warn" | "danger" | "violet"; icon?: ReactNode }) {
  const t = statTones[tone];
  return (
    <div className={`panel px-5 py-5 border-2 ${t.border} ${t.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="mono text-[11px] font-black uppercase tracking-[0.12em] text-gray-600">{label}</div>
        <div className={t.sub}>{icon}</div>
      </div>
      <div className={`text-[32px] font-black leading-none tabular-nums ${t.text}`}>{value}</div>
      {sub && <div className={`mt-2 text-[13px] font-bold leading-tight ${t.sub}`}>{sub}</div>}
    </div>
  );
}

export function TaskStateBadge({ status }: { status: TaskStatus }) {
  const meta = TASK_STATE_META[status]; // Asumimos que TASK_STATE_META ya existe en domain
  return (
    <span className="pill bg-gray-100 text-gray-700">
       {meta.label}
    </span>
  );
}

export function PriorityChip({ priority }: { priority: string }) {
  if (priority === "normal") return null;
  const map: Record<string, string> = {
    alta: "bg-amber-100 text-amber-800",
    critica: "bg-red-100 text-red-800 animate-pulse",
  };
  return <span className={`pill ${map[priority]}`}> {priority} </span>;
}

export function TaskPipeline({ status }: { status: TaskStatus }) {
  const steps = [
    { key: "notified" as const, label: "aviso" },
    { key: "accepted" as const, label: "tomada" },
    { key: "cleaning" as const, label: "limpieza" },
    { key: "pending_inspection" as const, label: "inspección" },
    { key: "completed" as const, label: "lista" },
  ];
  if (status === "cancelled" || status === "blocked") {
    return <div className="mono text-[10px] font-bold text-gray-400 uppercase tracking-widest">{status === "cancelled" ? "— ciclo anulado —" : "⏸ impedimento"}</div>;
  }
  const order: Record<string, number> = { pending_notice: 0, notified: 1, accepted: 2, cleaning: 3, cleaning_completed: 3.5, pending_inspection: 4, completed: 5 };
  const cur = order[status] ?? 0;
  return (
    <div className="flex items-center gap-1.5 py-2">
      {steps.map((s, i) => {
        const stepN = i + 1;
        const done = cur >= stepN;
        const active = Math.ceil(cur) === stepN && cur < 5;
        return (
          <div key={s.key} className="flex items-center gap-1.5">
            <div className="flex flex-col items-center">
              <div className={`h-2 w-10 rounded-full transition-all duration-300 ${done ? "bg-emerald-500" : active ? "bg-emerald-300" : "bg-gray-200"}`} />
              <div className={`mono mt-1.5 text-[9px] font-bold uppercase tracking-wider ${done || active ? "text-emerald-700" : "text-gray-400"}`}>{s.label}</div>
            </div>
            {i < steps.length - 1 && <div className="h-px w-2 bg-gray-100 mb-4" />}
          </div>
        );
      })}
    </div>
  );
}

export function Bars({ data, max, unit = "", tone = "emerald" }: { data: { label: string; value: number }[]; max?: number; unit?: string; tone?: "emerald" | "sky" | "violet" }) {
  const m = max ?? Math.max(1, ...data.map((d) => d.value));
  const fill = tone === "emerald" ? "#059669" : tone === "sky" ? "#0284c7" : "#7c3aed";
  return (
    <div className="flex items-end gap-2 h-32 pt-4">
      {data.map((d, i) => (
        <div key={i} className="group flex flex-1 flex-col items-center gap-1.5 h-full justify-end">
          <div className="mono text-[10px] font-bold text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">{d.value}{unit}</div>
          <div className="w-full rounded-t-lg transition-all duration-300 group-hover:brightness-110"
            style={{ height: `${Math.max(4, (d.value / m) * 100)}%`, background: fill, opacity: d.value === 0 ? 0.1 : 0.8 }} />
          <div className="mono text-[10px] font-bold text-gray-500 mt-1 uppercase">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export function TimeMark({ at, now }: { at: Date | null; now: Date }) {
  if (!at) return <span className="text-gray-400">—</span>;
  return <span className="mono text-[11px] font-bold text-gray-700">{hhmm(at)} <span className="text-gray-400 font-medium">({ago(at, now)})</span></span>;
}

export function EventDot({ kind }: { kind: string }) {
  const tone = EVENT_KIND_TONE[kind];
  const cls = tone === "danger" ? "bg-red-500" : tone === "warn" ? "bg-amber-500" : tone === "ok" ? "bg-emerald-500" : "bg-slate-300";
  return <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

