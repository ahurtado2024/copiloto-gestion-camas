import {
  LayoutGrid,
  BedDouble,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Inbox,
  FileText,
  BarChart3,
  ScrollText,
  Radio,
  Settings,
  Bell,
  BookOpen,
  TableProperties,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { loadCounts } from "@/lib/queries";
import { getRules } from "@/lib/config";
import { Nav, LiveClock } from "./client";

export default async function Shell({ children }: { children: ReactNode }) {
  const [counts, rules] = await Promise.all([
    loadCounts().catch(() => ({ pending: 0, conflicts: 0, escalated: 0, pendDatos: 0 })),
    getRules().catch(() => null),
  ]);
  const actor = rules?.TURNO_ACTOR ?? "M. Rojas";
  const initials = actor
    .split(/[.\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const groups = [
    {
      label: "Operación",
      items: [
        { href: "/", label: "Tablero", icon: <LayoutGrid size={16} /> },
        { href: "/camas", label: "Camas", icon: <BedDouble size={16} /> },
        { href: "/limpieza", label: "Limpieza", icon: <Sparkles size={16} />, badge: counts.escalated, tone: "amber" as const },
        { href: "/aprobaciones", label: "Aprobaciones", icon: <ShieldCheck size={16} />, badge: counts.pending, tone: "violet" as const },
        { href: "/conflictos", label: "Conflictos", icon: <AlertTriangle size={16} />, badge: counts.conflicts, tone: "rose" as const },
      ],
    },
    {
      label: "Memoria",
      items: [
        { href: "/bandeja", label: "Bandeja", icon: <Inbox size={16} />, badge: counts.pendDatos, tone: "amber" as const },
        { href: "/turno", label: "Turno", icon: <FileText size={16} /> },
        { href: "/metricas", label: "Métricas", icon: <BarChart3 size={16} /> },
        { href: "/registro", label: "Caja negra", icon: <ScrollText size={16} /> },
      ],
    },
    {
      label: "Sistema",
      items: [
        { href: "/ajustes", label: "Ajustes", icon: <Settings size={16} /> },
        { href: "/ajustes/hoja", label: "Hoja del turno", icon: <TableProperties size={16} /> },
        { href: "/ajustes/docs", label: "Documentación", icon: <BookOpen size={16} /> },
      ],
    },
  ];

  const allBadges = counts.pending + counts.conflicts + counts.escalated;

  return (
    <div className="flex min-h-screen">
      {/* ------- sidebar ------- */}
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar-bg)] md:flex">
        <div className="px-5 pb-4 pt-5">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
              <BedDouble size={16} className="text-white" />
            </div>
            <div>
              <div className="text-[13px] font-bold tracking-wide text-[var(--color-text)]">Copiloto</div>
              <div className="mono text-[9px] font-medium tracking-[0.12em] text-[var(--color-text-muted)]">GESTIÓN DE CAMAS</div>
            </div>
          </Link>
        </div>

        <Nav groups={groups} />

        <div className="mt-auto space-y-2 px-4 pb-5">
          <div className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border-light)] px-3 py-2">
            <Radio size={12} className="text-emerald-500" />
            <span className="text-[10px] font-medium text-[var(--color-text-muted)]">Registro en paralelo activo</span>
          </div>
          <Link href="/ajustes" className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-[var(--color-sidebar-hover)]">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
              {initials}
            </div>
            <div className="leading-tight">
              <div className="text-[11.5px] font-semibold text-[var(--color-text)]">{actor}</div>
              <div className="text-[9.5px] text-[var(--color-text-muted)]">Turno activo</div>
            </div>
          </Link>
        </div>
      </aside>

      {/* ------- main ------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-white/80 backdrop-blur-lg">
          <div className="flex items-center gap-3 px-4 py-2.5 md:px-7">
            <div className="flex items-center gap-2 md:hidden">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600">
                <BedDouble size={14} className="text-white" />
              </div>
              <span className="text-[12px] font-bold tracking-wide">Copiloto</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {allBadges > 0 && (
                <div className="hidden items-center gap-2 md:flex">
                  {counts.pending > 0 && (
                    <Link href="/aprobaciones" className="mono rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700 transition hover:bg-violet-100">
                      {counts.pending} propuesta{counts.pending > 1 ? "s" : ""}
                    </Link>
                  )}
                  {counts.conflicts > 0 && (
                    <Link href="/conflictos" className="mono rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-700 transition hover:bg-red-100">
                      {counts.conflicts} conflicto{counts.conflicts > 1 ? "s" : ""}
                    </Link>
                  )}
                </div>
              )}
              <button className="relative rounded-lg p-2 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)]">
                <Bell size={16} />
                {allBadges > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />}
              </button>
              <LiveClock />
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white md:hidden">
                {initials}
              </div>
            </div>
          </div>
          <div className="md:hidden">
            <Nav groups={groups} mobile />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-16 pt-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
