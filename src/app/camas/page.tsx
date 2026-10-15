import { BedDouble, AlertTriangle, Building2, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { loadBeds } from "@/lib/queries";
import { BED_STATUSES, BED_TYPE_LABEL } from "@/lib/domain";
import { ago, duration } from "@/lib/time";
import { PageHeader, Panel, BedStateBadge, EmptyState } from "@/components/ui";
import { Refresher } from "@/components/client";
import { TaskLink } from "@/components/links";
import BedActions from "@/components/bedactions";
import type { BedView } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function CamasPage({ searchParams }: { searchParams: Promise<{ est?: string; estado?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const { beds, ests } = await loadBeds(now);

  const estFilter = sp.est ?? null;
  const stateFilter = sp.estado ?? null;

  const filtered = beds.filter((b) => {
    if (estFilter && b.estCode !== estFilter) return false;
    if (stateFilter && b.effectiveStatus !== stateFilter) return false;
    return true;
  });

  const byUnit = new Map<string, BedView[]>();
  for (const b of filtered) {
    const key = `${b.estCode} · ${b.unit}`;
    if (!byUnit.has(key)) byUnit.set(key, []);
    byUnit.get(key)!.push(b);
  }

  const href = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const est = patch.est !== undefined ? patch.est : estFilter;
    const estado = patch.estado !== undefined ? patch.estado : stateFilter;
    if (est) q.set("est", est);
    if (estado) q.set("estado", estado);
    const s = q.toString();
    return s ? `/camas?${s}` : "/camas";
  };

  return (
    <>
      <Refresher seconds={30} />
      <PageHeader
        kicker="Operación · la fuente operacional sigue siendo tu hoja"
        title="Camas de la red"
        desc="El registro en paralelo: cada cama con su estado, su antigüedad y la frescura del dato. Click en cualquier cama para abrir su detalle completo: historia, ciclo, propuestas y mensajes."
      />

      {/* filtros */}
      <div className="rise mb-4 flex flex-wrap items-center gap-2">
        <FilterChip href={href({ est: null })} active={!estFilter} icon={<Building2 size={11} />} label="Toda la red" />
        {ests.map((e) => (
          <FilterChip key={e.id} href={href({ est: e.code })} active={estFilter === e.code} label={e.code} />
        ))}
        <span className="mx-1 h-4 w-px bg-white/10" />
        <FilterChip href={href({ estado: null })} active={!stateFilter} label="Todos los estados" />
        {BED_STATUSES.map((s) => (
          <FilterChip key={s} href={href({ estado: s })} active={stateFilter === s}
            label={s === "stale" ? "Vencido" : s === "occupied" ? "Ocupada" : s === "discharge_detected" ? "Alta detectada" : s === "pending_cleaning" ? "P. limpieza" : s === "cleaning" ? "Limpieza" : s === "cleaning_completed" ? "Limp. OK" : s === "pending_inspection" ? "P. inspección" : s === "available" ? "Disponible" : s === "reserved" ? "Reservada" : s === "blocked" ? "Bloqueada" : s === "out_of_service" ? "F. servicio" : "Desconocido"} />
        ))}
      </div>

      {filtered.length === 0 && (
        <Panel><EmptyState icon={<BedDouble size={17} />} title="Sin camas en este filtro" desc="Ajusta establecimiento o estado para ver el registro paralelo." /></Panel>
      )}

      <div className="space-y-6">
        {[...byUnit.entries()].map(([unit, unitBeds]) => (
          <div key={unit} className="rise">
            <div className="mb-2 flex items-baseline gap-3">
              <h2 className="text-[13px] font-bold tracking-wide text-white">{unit}</h2>
              <span className="mono text-[10px] text-slate-600">{unitBeds.length} camas</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {unitBeds.map((b) => (
                <BedCard key={b.id} b={b} now={now} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function FilterChip({ href, active, label, icon }: { href: string; active: boolean; label: string; icon?: React.ReactNode }) {
  return (
    <Link href={href} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ring-1 transition ${active ? "bg-teal-400/15 text-teal-200 ring-teal-400/40" : "bg-white/[0.03] text-slate-400 ring-white/10 hover:bg-white/[0.06] hover:text-slate-200"}`}>
      {icon}
      {label}
    </Link>
  );
}

function BedCard({ b, now }: { b: BedView; now: Date }) {
  return (
    <div className={`panel panel-hover group relative overflow-hidden p-3.5 ${b.openConflictId !== null ? "ring-1 ring-rose-400/40" : ""}`}>
      {b.openConflictId !== null && <div className="absolute inset-x-0 top-0 h-0.5 bg-rose-400/70" />}
      {b.stale && <div className="absolute inset-x-0 top-0 h-0.5 bg-yellow-500/60" />}
      <Link href={`/camas/${encodeURIComponent(b.code)}`} className="absolute inset-0 z-[5]" aria-label={`Detalle de ${b.code}`} />
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="mono text-[15px] font-bold text-white transition group-hover:text-sky-200">{b.code}</span>
            <ArrowUpRight size={11} className="text-slate-600 opacity-0 transition group-hover:opacity-100" />
            <span className="mono rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-400">{BED_TYPE_LABEL[b.bedType] ?? b.bedType}</span>
          </div>
          <div className="mt-0.5 text-[10.5px] text-slate-500">{b.unit} · {b.estCode}</div>
        </div>
        <BedStateBadge status={b.effectiveStatus} size="sm" />
      </div>

      <div className="pointer-events-none relative z-10 mt-2.5 space-y-1 text-[10.5px] text-slate-500">
        <div className="flex items-center justify-between">
          <span>en este estado</span>
          <span className="mono text-slate-400">{duration(b.minutesInStatus)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>última confirmación humana</span>
          <span className={`mono ${b.stale ? "text-yellow-300" : "text-slate-400"}`}>{ago(b.lastConfirmedAt, now)}</span>
        </div>
        {b.activeTaskCode && (
          <div className="flex items-center justify-between">
            <span>ciclo de aseo</span>
            <span className="pointer-events-auto relative z-20 text-[11px]"><TaskLink code={b.activeTaskCode} /></span>
          </div>
        )}
      </div>

      {b.note && <div className="pointer-events-none relative z-10 mono mt-2 rounded-md bg-white/[0.03] px-2 py-1 text-[9.5px] leading-snug text-slate-500">{b.note}</div>}

      {b.openConflictId !== null && (
        <div className="pointer-events-none relative z-10 mt-2 flex items-center gap-1.5 rounded-md bg-rose-400/10 px-2 py-1.5 text-[10.5px] font-medium text-rose-300 ring-1 ring-rose-400/30">
          <AlertTriangle size={11} /> conflicto C-{b.openConflictId} · escritura congelada
        </div>
      )}

      <div className="relative z-20 mt-3">
        <BedActions b={b} now={now} />
      </div>
    </div>
  );
}
