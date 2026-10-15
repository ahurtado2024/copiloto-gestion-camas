import { ScrollText, Lock, Fingerprint } from "lucide-react";
import Link from "next/link";
import { loadEvents } from "@/lib/queries";
import { EVENT_KIND_LABEL } from "@/lib/domain";
import { ago, dayTime } from "@/lib/time";
import { PageHeader, Panel, EventDot, EmptyState } from "@/components/ui";
import { Refresher } from "@/components/client";
import { BedLink } from "@/components/links";

export const dynamic = "force-dynamic";

export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ cama?: string; tipo?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const { events } = await loadEvents(now, 150);

  const kinds = [...new Set(events.map((e) => e.kind))];
  const bedCodes = [...new Set(events.filter((e) => e.bedCode).map((e) => e.bedCode!))];

  const filtered = events.filter((e) => {
    if (sp.cama && e.bedCode !== sp.cama) return false;
    if (sp.tipo && e.kind !== sp.tipo) return false;
    return true;
  });

  const href = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const cama = patch.cama !== undefined ? patch.cama : sp.cama ?? null;
    const tipo = patch.tipo !== undefined ? patch.tipo : sp.tipo ?? null;
    if (cama) q.set("cama", cama);
    if (tipo) q.set("tipo", tipo);
    const s = q.toString();
    return s ? `/registro?${s}` : "/registro";
  };

  return (
    <>
      <Refresher seconds={25} />
      <PageHeader
        kicker="UC-08 · R6 — la caja negra de vuelo"
        title="Registro paralelo"
        desc="Todo lo que se movió, con actor, hora, fuente y correlación. Reconstruir «qué pasó con la C-304 hoy» es una consulta, no una investigación. Este registro no se puede borrar ni editar."
      />

      <div className="rise mb-4 flex flex-wrap items-center gap-3 rounded-xl border hairline bg-white/[0.02] px-4 py-3">
        <span className="flex items-center gap-1.5 text-[11px] text-slate-400"><Lock size={12} className="text-emerald-400" /> append-only</span>
        <span className="flex items-center gap-1.5 text-[11px] text-slate-400"><Fingerprint size={12} className="text-sky-400" /> idempotente: repetir un evento no duplica efectos</span>
        <span className="mono ml-auto text-[10px] text-slate-600">{filtered.length} eventos visibles</span>
      </div>

      {/* filtros */}
      <div className="rise mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mono mr-1 text-[9.5px] uppercase tracking-widest text-slate-600">cama</span>
          <FilterLink href={href({ cama: null })} active={!sp.cama} label="todas" />
          {bedCodes.map((c) => (
            <FilterLink key={c} href={href({ cama: c })} active={sp.cama === c} label={c} mono />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mono mr-1 text-[9.5px] uppercase tracking-widest text-slate-600">tipo</span>
          <FilterLink href={href({ tipo: null })} active={!sp.tipo} label="todos" />
          {kinds.map((k) => (
            <FilterLink key={k} href={href({ tipo: k })} active={sp.tipo === k} label={EVENT_KIND_LABEL[k] ?? k} />
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Panel><EmptyState icon={<ScrollText size={17} />} title="Sin eventos en este filtro" desc="La historia completa está guardada — ajusta los filtros para consultarla." /></Panel>
      ) : (
        <div className="rise relative">
          <div className="absolute bottom-6 left-[7px] top-6 w-px bg-white/[0.06]" />
          <div className="space-y-1">
            {filtered.map((e) => (
              <div key={e.id} className="relative flex gap-4 rounded-xl px-1 py-2.5 transition hover:bg-white/[0.02]">
                <div className="relative z-10 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center bg-[#05070a]">
                  <EventDot kind={e.kind} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] leading-snug text-slate-200">{e.summary}</div>
                  <div className="mono mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[9px] uppercase tracking-wider text-slate-600">
                    <span className="text-slate-400">{dayTime(e.ts)} · {ago(e.ts, now)}</span>
                    <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-slate-400">{EVENT_KIND_LABEL[e.kind] ?? e.kind}</span>
                    <span>actor: <span className="text-slate-400">{e.actor}</span></span>
                    <span>vía: <span className="text-slate-400">{e.source}</span></span>
                    {e.bedCode && (
                      <span className="text-[9px]"><BedLink code={e.bedCode} /></span>
                    )}
                    {typeof (e.payload as { cycle_minutes?: unknown }).cycle_minutes === "number" && (
                      <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-emerald-300 ring-1 ring-emerald-400/30">
                        ciclo {String((e.payload as { cycle_minutes: number }).cycle_minutes)} min
                      </span>
                    )}
                    {typeof (e.payload as { m1_minutes?: unknown }).m1_minutes === "number" && (
                      <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-amber-300 ring-1 ring-amber-400/30">
                        M1 {String((e.payload as { m1_minutes: number }).m1_minutes)} min
                      </span>
                    )}
                    {e.dedupeKey && <span className="text-slate-700" title={e.dedupeKey}>dedupe ✓</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function FilterLink({ href, active, label, mono = false }: { href: string; active: boolean; label: string; mono?: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-2 py-1 text-[10.5px] font-medium ring-1 transition ${mono ? "mono" : ""} ${
        active ? "bg-emerald-400/15 text-emerald-200 ring-emerald-400/40" : "bg-white/[0.03] text-slate-500 ring-white/10 hover:bg-white/[0.06] hover:text-slate-300"
      }`}
    >
      {label}
    </Link>
  );
}
