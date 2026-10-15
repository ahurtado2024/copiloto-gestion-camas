import Link from "next/link";
import { BedDouble, Mail, MessageSquare, SendHorizontal, ArrowUpRight } from "lucide-react";

export function BedLink({ code, className = "" }: { code: string; className?: string }) {
  return (
    <Link href={`/camas/${encodeURIComponent(code)}`} title={`Ver detalle de ${code}`}
      className={`mono group inline-flex items-center gap-0.5 font-bold text-emerald-700 transition hover:text-emerald-600 ${className}`}>
      {code}<ArrowUpRight size={10} className="opacity-0 transition group-hover:opacity-100" />
    </Link>
  );
}

export function BedChip({ code }: { code: string }) {
  return (
    <Link href={`/camas/${encodeURIComponent(code)}`}
      className="mono inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10.5px] font-bold text-emerald-700 transition hover:bg-emerald-100">
      <BedDouble size={10} /> {code}
    </Link>
  );
}

export function TaskLink({ code }: { code: string }) {
  return (
    <Link href={`/limpieza/${encodeURIComponent(code)}`} title={`Ver ciclo ${code}`}
      className="mono inline-flex items-center gap-0.5 font-semibold text-sky-700 transition hover:text-sky-600">
      {code}<ArrowUpRight size={10} className="opacity-60" />
    </Link>
  );
}

export function MessageRef({ id, label }: { id: number; label: string }) {
  return (
    <Link href={`/bandeja/${id}`}
      className="mono inline-flex items-center gap-0.5 text-[10px] text-[var(--color-text-muted)] underline decoration-gray-300 underline-offset-2 transition hover:text-[var(--color-text)]">
      {label}
    </Link>
  );
}

export const CHANNEL_META: Record<string, { label: string; short: string; bar: string; chip: string; soft: string; iconColor: string }> = {
  correo:   { label: "Correo institucional", short: "CORREO",   bar: "bg-amber-400",   chip: "bg-amber-50 text-amber-700",   soft: "border-amber-200 bg-amber-50",   iconColor: "text-amber-600" },
  telegram: { label: "Telegram del turno",   short: "TELEGRAM", bar: "bg-sky-400",     chip: "bg-sky-50 text-sky-700",       soft: "border-sky-200 bg-sky-50",       iconColor: "text-sky-600" },
  whatsapp: { label: "WhatsApp del turno",   short: "WHATSAPP", bar: "bg-emerald-400", chip: "bg-emerald-50 text-emerald-700",soft: "border-emerald-200 bg-emerald-50",iconColor: "text-emerald-600" },
  panel:    { label: "Panel del copiloto",   short: "PANEL",    bar: "bg-violet-400",  chip: "bg-violet-50 text-violet-700", soft: "border-violet-200 bg-violet-50", iconColor: "text-violet-600" },
  hoja:     { label: "Hoja del turno",       short: "HOJA",     bar: "bg-teal-400",    chip: "bg-teal-50 text-teal-700",     soft: "border-teal-200 bg-teal-50",     iconColor: "text-teal-600" },
  sistema:  { label: "Sistema",              short: "SISTEMA",  bar: "bg-slate-300",   chip: "bg-slate-100 text-slate-600",  soft: "border-slate-200 bg-slate-50",   iconColor: "text-slate-500" },
};

export function ChannelBadge({ channel, size = "md" }: { channel: string; size?: "sm" | "md" }) {
  const meta = CHANNEL_META[channel] ?? CHANNEL_META.sistema;
  const Icon = channel === "correo" ? Mail : channel === "telegram" || channel === "whatsapp" ? MessageSquare : SendHorizontal;
  return (
    <span className={`mono inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider ${meta.chip} ${size === "sm" ? "px-1.5 py-0.5 text-[8.5px]" : "px-2 py-1 text-[9.5px]"}`}>
      <Icon size={size === "sm" ? 9 : 11} /> {meta.short}
    </span>
  );
}

export function channelBar(channel: string): string {
  return (CHANNEL_META[channel] ?? CHANNEL_META.sistema).bar;
}
