import { Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
import { loadTasks } from "@/lib/queries";
import { getRules } from "@/lib/config";
import type { TaskStatus } from "@/lib/domain";
import { duration, minutesBetween } from "@/lib/time";
import { PageHeader, Panel, PanelTitle, TaskStateBadge, EmptyState } from "@/components/ui";
import { Refresher } from "@/components/client";
import { BedLink, TaskLink } from "@/components/links";
import TaskCard from "@/components/taskcard";

export const dynamic = "force-dynamic";

export default async function LimpiezaPage() {
  const now = new Date();
  const [rules, { active, closed }] = await Promise.all([getRules(), loadTasks(now)]);

  return (
    <>
      <Refresher seconds={20} />
      <PageHeader
        kicker="El flujo que hay que acelerar"
        title="Ciclo de limpieza"
        desc="Los dos saltos que definen el proyecto: confirmar el alta dispara el aviso EN EL MISMO ACTO (3→4), y la disponibilidad solo nace de tu inspección humana (6→7) — jamás de una inferencia. Click en una tarea para su detalle con métricas por etapa."
      />

      <Panel className="rise mb-4 px-4 py-3.5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {[
            { n: "1→2", txt: `el aviso sale al confirmar el alta por ${rules.CANAL_ASEO} — aquí nacía el desperdicio`, t: "text-amber-300" },
            { n: "2→6", txt: "aseo informa con botones y marcas de tiempo: tomó, inició, terminó", t: "text-sky-300" },
            { n: "6→7", txt: "inspección humana: ropa, baño, insumos — nunca se automatiza", t: "text-emerald-300" },
          ].map((s, i) => (
            <div key={s.n} className="flex flex-1 items-center gap-3">
              <span className={`mono text-[13px] font-bold ${s.t}`}>{s.n}</span>
              <span className="text-[11.5px] leading-snug text-slate-400">{s.txt}</span>
              {i < 2 && <ArrowRight size={13} className="ml-auto hidden shrink-0 text-slate-700 md:block" />}
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <div className="mono text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
            Ciclo activo · {active.length} tarea{active.length !== 1 ? "s" : ""}
          </div>
          {active.length === 0 && (
            <Panel>
              <EmptyState icon={<Sparkles size={17} />} title="Sin ciclos de aseo activos" desc="Cuando confirmes un alta, la tarea se crea y se avisa a aseo en el mismo movimiento. Toda la traza queda aquí." />
            </Panel>
          )}
          {active.map((t) => (
            <div key={t.id} className="rise">
              <TaskCard t={t} now={now} />
            </div>
          ))}
        </div>

        <Panel className="rise rise-1 h-fit">
          <PanelTitle icon={<CheckCircle2 size={14} />} title="Cierres recientes" sub="ciclos completados y anulados" />
          {closed.length === 0 ? (
            <EmptyState icon={<CheckCircle2 size={17} />} title="Aún sin cierres" desc="Las tareas completadas se muestran con su tiempo total de ciclo (M2)." />
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {closed.map((t) => (
                <div key={t.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px]"><TaskLink code={t.code} /></span>
                    <TaskStateBadge status={t.status as TaskStatus} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10.5px] text-slate-500">
                    <span><BedLink code={t.bedCode} /> · {t.unit}</span>
                    {t.status === "completed" && t.closedAt && (
                      <span className="mono text-emerald-300">ciclo {duration(minutesBetween(t.detectedAt, t.closedAt))}</span>
                    )}
                    {t.status === "cancelled" && (
                      <span className="mono text-zinc-500" title={t.cancelReason ?? ""}>anulada</span>
                    )}
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
