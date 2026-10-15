import { AlertTriangle, Scale, Snowflake, CheckCircle2 } from "lucide-react";
import { loadConflicts } from "@/lib/queries";
import { BED_STATE_META, type BedStatus } from "@/lib/domain";
import { ago, dayTime } from "@/lib/time";
import { PageHeader, Panel, PanelTitle, BedStateBadge, EmptyState } from "@/components/ui";
import { ResolveConflictWidget, Refresher } from "@/components/client";
import { BedLink } from "@/components/links";

export const dynamic = "force-dynamic";

function label(v: string) {
  return BED_STATE_META[v as BedStatus]?.label ?? v;
}

export default async function ConflictosPage() {
  const now = new Date();
  const { open, resolved } = await loadConflicts(now);

  return (
    <>
      <Refresher seconds={30} />
      <PageHeader
        kicker="R3 · nadie pisa a nadie en silencio"
        title="Conflictos entre fuentes"
        desc="Cuando la hoja dice una cosa y el correo otra, el sistema no elige: registra ambas, congela la escritura automática de ese dato y espera tu criterio — que queda guardado para aprender."
      />

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <div className="mono text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
            Abiertos · {open.length}
          </div>
          {open.length === 0 && (
            <Panel>
              <EmptyState icon={<Scale size={17} />} title="Sin fuentes en contradicción" desc="Cuando dos fuentes discrepen sobre una cama, el conflicto aparece aquí con ambos valores y sus orígenes." />
            </Panel>
          )}
          {open.map((c) => (
            <div key={c.id} className="panel rise relative overflow-hidden p-4 ring-1 ring-rose-400/30">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-rose-400/70" />
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="mono text-[13px] font-bold text-rose-300">C-{c.id}</span>
                <span className="text-[13px]"><BedLink code={c.bedCode} /></span>
                <span className="text-[11px] text-slate-500">{c.unit}</span>
                <span className="mono ml-auto text-[10px] text-slate-500">abierto {ago(c.createdAt, now)}</span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border hairline bg-black/30 p-3">
                  <div className="mono text-[9px] uppercase tracking-[0.16em] text-slate-500">fuente A</div>
                  <div className="mt-1 text-[12px] font-medium text-slate-300">{c.sourceA}</div>
                  <div className="mt-2"><BedStateBadge status={c.valueA as BedStatus} size="sm" /></div>
                </div>
                <div className="rounded-xl border border-rose-400/25 bg-rose-400/[0.04] p-3">
                  <div className="mono text-[9px] uppercase tracking-[0.16em] text-rose-300/70">fuente B — contradice</div>
                  <div className="mt-1 text-[12px] font-medium text-slate-300">{c.sourceB}</div>
                  <div className="mt-2"><BedStateBadge status={c.valueB as BedStatus} size="sm" /></div>
                </div>
              </div>

              <div className="mono mt-3 flex items-center gap-2 rounded-lg bg-cyan-400/[0.06] px-3 py-2 text-[10px] text-cyan-200/80 ring-1 ring-cyan-400/20">
                <Snowflake size={12} />
                escritura automática congelada sobre {c.bedCode} — estado actual del tablero: {label(c.currentStatus).toLowerCase()}
              </div>

              <div className="mt-3">
                <ResolveConflictWidget
                  conflictId={c.id}
                  sourceA={c.sourceA}
                  valueA={c.valueA}
                  sourceB={c.sourceB}
                  valueB={c.valueB}
                  labelA={`gana: ${label(c.valueA).toLowerCase()}`}
                  labelB={`gana: ${label(c.valueB).toLowerCase()}`}
                />
                <p className="mono mt-2 text-[9.5px] leading-relaxed text-slate-600">
                  nota: ni siquiera resolviendo un conflicto se puede declarar «disponible» — R2 exige ciclo de aseo + inspección humana.
                </p>
              </div>
            </div>
          ))}
        </div>

        <Panel className="rise rise-1 h-fit">
          <PanelTitle icon={<CheckCircle2 size={14} />} title="Resueltos — criterios guardados" sub="sirven para aprender y capacitar" />
          {resolved.length === 0 ? (
            <EmptyState icon={<AlertTriangle size={17} />} title="Sin resoluciones aún" desc="Cada conflicto resuelto deja el criterio explícito del humano." />
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {resolved.map((c) => (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[10px] text-slate-500">C-{c.id}</span>
                    <span className="text-[11.5px]"><BedLink code={c.bedCode} /></span>
                    <span className="mono ml-auto text-[9.5px] text-slate-600">{c.resolvedAt ? dayTime(c.resolvedAt) : ""}</span>
                  </div>
                  <div className="mt-1 text-[11.5px] text-slate-300">
                    ganó <span className="font-semibold text-emerald-300">{c.resolution ? label(c.resolution).toLowerCase() : "—"}</span> · resolvió {c.resolvedBy}
                  </div>
                  <div className="mono mt-1 rounded-md bg-white/[0.03] px-2 py-1.5 text-[10px] leading-relaxed text-slate-500">
                    “{c.criterion}”
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
