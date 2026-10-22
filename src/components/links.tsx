import Link from "next/link";
import { BedDouble, Mail, MessageSquare, SendHorizontal, ArrowUpRight } from "lucide-react";

export function BedLink({ code, className = "" }: { code: string; className?: string }) {
  return (
    <Link href={`/camas/${encodeURIComponent(code)}`} title={`Ver detalle de ${code}`}
      className={`mono group inline-flex items-center gap-1 font-black text-emerald-700 transition hover:text-emerald-900 ${className}`}>
      {code}<ArrowUpRight size={12} className="opacity-40 transition group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );
}

export function BedLabel({ code, className = "" }: { code: string; className?: string }) {
  return (
    <span className={`mono font-black text-emerald-800 ${className}`}>
      {code}
    </span>
  );
}

export function BedChip({ code }: { code: string }) {
  return (
    <Link href={`/camas/${encodeURIComponent(code)}`}
      className="mono inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 border border-emerald-100 transition hover:bg-emerald-100 hover:border-emerald-200">
      <BedDouble size={12} /> {code}
    </Link>
  );
}

export function TaskLink({ code }: { code: string }) {
  return (
    <Link href={`/limpieza/${encodeURIComponent(code)}`} title={`Ver ciclo ${code}`}
      className="mono inline-flex items-center gap-1 font-bold text-sky-700 transition hover:text-sky-900">
      {code}<ArrowUpRight size={12} className="opacity-40" />
    </Link>
  );
}

export function TaskLabel({ code }: { code: string }) {
  return (
    <span className="mono font-bold text-sky-800">{code}</span>
  );
}

export function MessageRef({ id, label }: { id: number; label: string }) {
  return (
    <Link href={`/bandeja/${id}`}
      className="mono inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 underline decoration-gray-300 underline-offset-4 transition hover:text-gray-900 hover:decoration-gray-900">
      {label}
    </Link>
  );
}

export const CHANNEL_META: Record<string, { label: string; short: string; bar: string; chip: string; iconColor: string }> = {
  correo:   { label: "Correo",    short: "CORREO",   bar: "bg-amber-500",   chip: "bg-amber-100 text-amber-800 border-amber-200",   iconColor: "text-amber-600" },
  telegram: { label: "Telegram",  short: "TELEGRAM", bar: "bg-sky-500",     chip: "bg-sky-100 text-sky-800 border-sky-200",       iconColor: "text-sky-600" },
  whatsapp: { label: "WhatsApp",  short: "WHATSAPP", bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800 border-emerald-200",iconColor: "text-emerald-600" },
  panel:    { label: "Panel",     short: "PANEL",    bar: "bg-violet-500",  chip: "bg-violet-100 text-violet-800 border-violet-200", iconColor: "text-violet-600" },
  hoja:     { label: "Hoja",       short: "HOJA",     bar: "bg-teal-500",    chip: "bg-teal-100 text-teal-800 border-teal-200",     iconColor: "text-teal-600" },
  sistema:  { label: "Sistema",   short: "SISTEMA",  bar: "bg-gray-400",   chip: "bg-gray-100 text-gray-700 border-gray-200",   iconColor: "text-gray-500" },
};

export function ChannelBadge({ channel, size = "md" }: { channel: string; size?: "sm" | "md" }) {
  const meta = CHANNEL_META[channel] ?? CHANNEL_META.sistema;
  const Icon = channel === "correo" ? Mail : MessageSquare;
  return (
    <span className={`mono inline-flex items-center gap-1.5 rounded-lg font-black uppercase tracking-widest border ${meta.chip} ${size === "sm" ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"}`}>
      <Icon size={size === "sm" ? 10 : 12} /> {meta.short}
    </span>
  );
}

export function channelBar(channel: string): string {
  return (CHANNEL_META[channel] ?? CHANNEL_META.sistema).bar;
}

