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
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { loadCounts } from "@/lib/queries";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/rbac";
import { Nav, LiveClock } from "./client";
import { SignOutButton } from "./signout-button";

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin:      { label: "Admin",     color: "bg-rose-100 text-rose-700" },
  encargada:  { label: "Encargada", color: "bg-emerald-100 text-emerald-700" },
  aseo:       { label: "Aseo",      color: "bg-sky-100 text-sky-700" },
  jefatura:   { label: "Jefatura",  color: "bg-violet-100 text-violet-700" },
  viewer:     { label: "Lector",    color: "bg-slate-100 text-slate-600" },
};

export default async function Shell({ children }: { children: ReactNode }) {
  const [counts, session] = await Promise.all([
    loadCounts().catch(() => ({ pending: 0, conflicts: 0, escalated: 0, pendDatos: 0 })),
    auth(),
  ]);

  const authUser = session?.user as { name?: string; email?: string; role?: string; id?: string } | undefined;
  const userName = authUser?.name  ?? "Usuario";
  const userEmail = authUser?.email ?? "";
  const userRole = authUser?.role  ?? "viewer";

  const initials = userName
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const roleInfo = ROLE_LABELS[userRole] ?? ROLE_LABELS.viewer;

  const groups = [
    {
      label: "Operación",
      items: [
        { href: "/", label: "Tablero", icon: <LayoutGrid size={18} /> },
        { href: "/camas", label: "Camas", icon: <BedDouble size={18} /> },
        hasPermission(userRole, "tasks:view") && {
          href: "/limpieza", label: "Limpieza", icon: <Sparkles size={18} />,
          badge: counts.escalated, tone: "amber" as const,
        },
        hasPermission(userRole, "approvals:view") && {
          href: "/aprobaciones", label: "Aprobaciones", icon: <ShieldCheck size={18} />,
          badge: counts.pending, tone: "violet" as const,
        },
        hasPermission(userRole, "conflicts:view") && {
          href: "/conflictos", label: "Conflictos", icon: <AlertTriangle size={18} />,
          badge: counts.conflicts, tone: "rose" as const,
        },
      ].filter(Boolean),
    },
    {
      label: "Memoria",
      items: [
        hasPermission(userRole, "mail:view") && {
          href: "/bandeja", label: "Bandeja", icon: <Inbox size={18} />,
          badge: counts.pendDatos, tone: "amber" as const,
        },
        hasPermission(userRole, "agenda:view") && {
          href: "/agenda", label: "Agenda Red", icon: <Users size={18} />,
        },
        hasPermission(userRole, "turno:view") && {
          href: "/turno", label: "Turno", icon: <FileText size={18} />,
        },
        hasPermission(userRole, "metrics:view") && {
          href: "/metricas", label: "Métricas", icon: <BarChart3 size={18} />,
        },
        hasPermission(userRole, "registro:view") && {
          href: "/registro", label: "Caja negra", icon: <ScrollText size={18} />,
        },
      ].filter(Boolean),
    },
    {
      label: "Sistema",
      items: [
        hasPermission(userRole, "settings:view") && {
          href: "/ajustes", label: "Ajustes", icon: <Settings size={18} />,
        },
        hasPermission(userRole, "sheets:view") && {
          href: "/ajustes/hoja", label: "Hoja del turno", icon: <TableProperties size={18} />,
        },
        { href: "/ajustes/docs", label: "Documentación", icon: <BookOpen size={18} /> },
      ].filter(Boolean),
    },
  ] as any[];

  const allBadges = counts.pending + counts.conflicts + counts.escalated;

  return (
    <div className="flex min-h-screen">
      {/* ------- Sidebar (Fondo Blanco y Bordes Finos) ------- */}
      <aside className="hidden w-[240px] shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
        <div className="px-6 pb-6 pt-7">
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-200">
              <BedDouble size={18} className="text-white" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white animate-pulse" />
            </div>
            <div>
              <div className="text-[15px] font-black tracking-tight text-gray-900 leading-none">Copiloto</div>
              <div className="mono text-[9px] font-bold tracking-[0.1em] text-emerald-600 mt-1 uppercase">Gestión de Camas</div>
            </div>
          </Link>
        </div>

        <Nav groups={groups} />

        <div className="mt-auto space-y-4 px-5 pb-8">
          <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2">
            <Radio size={12} className="text-emerald-500" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">En Paralelo</span>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[12px] font-black text-white">
                {initials || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-gray-900 leading-tight">{userName}</div>
                <div className={`mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${roleInfo.color}`}>
                  {roleInfo.label}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-50">
               <SignOutButton />
            </div>
          </div>
        </div>
      </aside>

      {/* ------- Main Container ------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/80 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-6 md:px-10">
            <div className="flex items-center gap-2 md:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
                <BedDouble size={16} className="text-white" />
              </div>
              <span className="text-[14px] font-black tracking-tight">Copiloto</span>
            </div>

            <div className="ml-auto flex items-center gap-4">
              {allBadges > 0 && (
                <div className="hidden items-center gap-2.5 md:flex">
                  {counts.pending > 0 && hasPermission(userRole, "approvals:view") && (
                    <Link href="/aprobaciones" className="mono rounded-full bg-violet-100 px-3 py-1 text-[11px] font-bold text-violet-700 transition hover:bg-violet-200">
                      {counts.pending} propuestas
                    </Link>
                  )}
                  {counts.conflicts > 0 && hasPermission(userRole, "conflicts:view") && (
                    <Link href="/conflictos" className="mono rounded-full bg-red-100 px-3 py-1 text-[11px] font-bold text-red-700 transition hover:bg-red-200">
                      {counts.conflicts} conflictos
                    </Link>
                  )}
                </div>
              )}

              <div className="h-6 w-px bg-gray-100 mx-1" />
              
              <button className="relative rounded-xl p-2 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600 border border-transparent hover:border-gray-100">
                <Bell size={18} />
                {allBadges > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}
              </button>

              <LiveClock />

              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-[12px] font-black text-white md:hidden shadow-lg shadow-emerald-100">
                {initials || "?"}
              </div>
            </div>
          </div>
          
          <div className="md:hidden border-t border-gray-50 bg-white">
            <Nav groups={groups} mobile />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-8 md:px-10">{children}</main>
      </div>
    </div>
  );
}

