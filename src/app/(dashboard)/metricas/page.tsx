import { BarChart3, TrendingDown, TrendingUp, Target, ClipboardList, Ban, CircleCheck, CircleX } from "lucide-react";
import { redirect } from "next/navigation";
import { computeMetrics } from "@/lib/metrics";
import { duration } from "@/lib/time";
import { PageHeader, Panel, PanelTitle, Bars } from "@/components/ui";
import { Refresher } from "@/components/client";
import { getCurrentRole } from "@/lib/session";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function MetricasPage() {
  const role = await getCurrentRole();
  if (!hasPermission(role, "metrics:view")) redirect("/");

  const now = new Date();
  const m = await computeMetrics(now);

  const cards = [
    {
      code: "M1", name: "minutos alta → aviso a limpieza", value: m.m1.avg !== null ? `${m.m1.avg} min` : "—",
      dir: "down" as const, ok: m.m1.avg !== null && m.m1.avg <= 10,
      def: "desde la detección/confirmación del alta hasta que el aviso sale a aseo",
      foot: `${m.m1.n} ciclos medidos · objetivo < 5 min con humano disponible`,
    },
    {
      code: "M2", name: "minutos alta → cama disponible", value: m.m2.avg !== null ? duration(m.m2.avg) : "—",
      dir: "down" as const, ok: true,
      def: "ciclo completo con inspección humana incluida",
      foot: `${m.m2.n} camas devueltas al sistema`,
    },
    {
      code: "M3", name: "camas disponibles sin aviso", value: String(m.m3.availableWithoutNotice),
      dir: "zero" as const, ok: m.m3.availableWithoutNotice === 0,
      def: "cama dada por disponible sin haber avisado/registrado el ciclo",
      foot: "objetivo: 0, siempre",
    },
    {
      code: "M4", name: "limpiezas fuera de plazo", value: String(m.m4.overdue),
      dir: "down" as const, ok: m.m4.overdue === 0,
      def: "espera sobre el SLA sin movimiento (genera escalado, no silencio)",
      foot: m.m4.overdueCodes.length ? m.m4.overdueCodes.join(" · ") : "ninguna ahora mismo",
    },
    {
      code: "M5", name: "interrupciones evitadas", value: String(m.m5.answered),
      dir: "up" as const, ok: true,
      def: "consultas «¿tenís cama?» respondidas por el sistema sin tocar al humano",
      foot: "protege el tiempo del turno",
    },
    {
      code: "M6", name: "escrituras no autorizadas", value: "0",
      dir: "zero" as const, ok: true,
      def: "nada se aplicó sin aprobación humana — por construcción, siempre 0",
      foot: `${m.m6.blockedWrites} intentos detenidos y registrados en la caja negra`,
    },
    {
      code: "M7", name: "conflictos detectados / resueltos", value: `${m.m7.opened} / ${m.m7.resolved}`,
      dir: "up" as const, ok: true,
      def: "detectar ↑ es bueno (el sistema ve); resolver rápido también",
      foot: m.m7.avgResolutionMin !== null ? `resolución promedio ${duration(m.m7.avgResolutionMin)}` : "sin resoluciones aún",
    },
    {
      code: "M8", name: "propuestas vencidas sin decidir", value: String(m.m8.expired),
      dir: "down" as const, ok: m.m8.expired === 0,
      def: "caducaron esperando al humano — señal de carga o de desconfianza",
      foot: `${m.m8.decided} decididas a tiempo por el turno`,
    },
  ];

  return (
    <>
      <Refresher seconds={45} />
      <PageHeader
        kicker="R9 · sin número no hay prioridad ni demostración"
        title="Métricas del sistema"
        desc="Todo se calcula desde la caja negra: tiempos por etapa, promesas cumplidas y ruido medido. 'Se siente más rápido' no convence a nadie — esto sí."
      />

      <div className="rise grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Panel key={c.code} className="panel-hover px-4 py-3.5">
            <div className="flex items-center justify-between">
              <span className="mono text-[10px] font-bold tracking-[0.2em] text-slate-500">{c.code}</span>
              {c.dir === "zero" ? (
                <Target size={13} className={c.ok ? "text-emerald-400" : "text-rose-400"} />
              ) : c.dir === "down" ? (
                <TrendingDown size={13} className={c.ok ? "text-emerald-400" : "text-amber-400"} />
              ) : (
                <TrendingUp size={13} className="text-emerald-400" />
              )}
            </div>
            <div className={`mt-2 text-[26px] font-bold leading-none tabular-nums ${c.ok ? "text-white" : "text-amber-300"}`}>{c.value}</div>
            <div className="mt-1 text-[11px] font-semibold text-slate-300">{c.name}</div>
            <div className="mt-1.5 text-[10px] leading-relaxed text-slate-500">{c.def}</div>
            <div className="mono mt-2 border-t hairline pt-1.5 text-[9.5px] text-slate-600">{c.foot}</div>
          </Panel>
        ))}
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Panel className="rise rise-1">
          <PanelTitle icon={<BarChart3 size={14} />} title="M1 por ciclo" sub="minutos detección → aviso a aseo" />
          <div className="px-4 pb-4 pt-2">
            {m.m1.samples.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-slate-600">aún sin muestras</div>
            ) : (
              <Bars unit="m" data={m.m1.samples.map((s) => ({ label: s.code.slice(-4), value: s.mins }))} />
            )}
            <div className="mono mt-2 border-t hairline pt-2 text-[9.5px] text-slate-600">
              la línea de meta (10 min) es donde el salto 3→4 deja de costar horas
            </div>
          </div>
        </Panel>

        <Panel className="rise rise-1">
          <PanelTitle icon={<BarChart3 size={14} />} title="M2 por ciclo completado" sub="minutos alta → disponible, con inspección" />
          <div className="px-4 pb-4 pt-2">
            {m.series.cycles.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-slate-600">aún sin ciclos completos</div>
            ) : (
              <Bars tone="violet" unit="m" data={m.series.cycles.map((s) => ({ label: s.label, value: s.mins }))} />
            )}
          </div>
        </Panel>

        <Panel className="rise rise-1">
          <PanelTitle icon={<ClipboardList size={14} />} title="Línea base manual" sub="pendiente — sin ella, todo lo demás es opinión" />
          <div className="space-y-2.5 p-4">
            <p className="text-[11.5px] leading-relaxed text-slate-400">
              Plantilla <span className="mono text-slate-300">docs/METRICAS-BASE.md</span>: registrar 5–10 casos del proceso <em>manual real</em> —
              hora del alta, cuándo se supo, cuándo se avisó, cuándo tomó aseo, término y disponibilidad confirmada.
            </p>
            <div className="rounded-lg border border-amber-400/25 bg-amber-400/[0.05] px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/90">
              Regla metodológica: medir el proceso tal como está hoy, <b>sin mejorarlo durante la medición</b>, y anotar las horas
              aunque incomoden. El número que más duele es el que más valor tiene.
            </div>
            <div className="rounded-lg border hairline bg-white/[0.02] px-3 py-2.5">
              <div className="mono text-[9.5px] uppercase tracking-[0.18em] text-slate-500">ejemplo de referencia del negocio (a confirmar)</div>
              <div className="mt-1 text-[11px] text-slate-400">
                cama libre-no-usable <span className="mono text-slate-200">~5 h 55 min</span>: alta 08:15 → aviso 09:22 → aseo 10:40–13:30 → visto 14:10
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Panel className="rise rise-2">
          <PanelTitle icon={<CircleCheck size={14} />} title="Criterios de éxito del piloto" sub="umbral sugerido, a negociar con el usuario" />
          <div className="space-y-2 p-4">
            {[
              "≥ 60 % de los altas generan aviso a aseo en < 10 min desde la confirmación",
              "0 incidentes de «cama ofrecida sin estar disponible» atribuibles al sistema",
              "el encargado usa el canal al menos 1 vez por turno, sin que nadie le insista",
              "el informe de cierre sale del sistema (no a mano) en todos los turnos del piloto",
              "si el sistema se apaga, nadie puede decir «no puedo trabajar»",
            ].map((x) => (
              <div key={x} className="flex items-start gap-2.5 text-[12px] leading-relaxed text-slate-300">
                <CircleCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" /> {x}
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="rise rise-2">
          <PanelTitle icon={<Ban size={14} />} title="Lo que NO es éxito" sub="para no perder el norte" />
          <div className="space-y-2 p-4">
            {[
              "«muchos mensajes intercambiados» — es ruido, no valor",
              "automatizar la respuesta externa sin aprobación (viola R1 y R2)",
              "reemplazar la hoja en el primer trimestre — mata la adopción",
              "«que el sistema siempre tenga razón» — debe poder decir «no sé», y pronto",
            ].map((x) => (
              <div key={x} className="flex items-start gap-2.5 text-[12px] leading-relaxed text-slate-300">
                <CircleX size={14} className="mt-0.5 shrink-0 text-rose-400" /> {x}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
