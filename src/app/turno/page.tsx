import { FileText, PackageCheck, ArrowRight, History, ExternalLink } from "lucide-react";
import { loadTurno } from "@/lib/queries";
import { EVENT_KIND_LABEL } from "@/lib/domain";
import { ago, dayTime, duration, hhmm } from "@/lib/time";
import { PageHeader, Panel, PanelTitle, EmptyState, EventDot } from "@/components/ui";
import { ActionButton, ExportButton, Refresher } from "@/components/client";
import { BedLink, TaskLink } from "@/components/links";

export const dynamic = "force-dynamic";

export default async function TurnoPage() {
  const now = new Date();
  const t = await loadTurno(now);

  const m1s = t.completedInWindow.filter((x) => x.m1 !== null).map((x) => x.m1!);
  const cycles = t.completedInWindow.filter((x) => x.cycle !== null).map((x) => x.cycle!);
  const m1avg = m1s.length ? Math.round(m1s.reduce((a, b) => a + b, 0) / m1s.length) : null;
  const m2avg = cycles.length ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : null;
  const inheritedTotal = t.inherited.tasks.length + t.inherited.approvals.length + t.inherited.conflicts.length;

  // UC-09: tablas listas para el software oficial (sin datos clínicos)
  const exportRows = [
    "establecimiento;unidad;cama;alta_detectada;aviso_aseo;inicio_limpieza;termino_limpieza;inspeccion_ok;min_alta_aviso;min_ciclo_total",
    ...t.completedInWindow.map((c) =>
      [
        c.estCode ?? "", c.unit ?? "", c.bedCode,
        c.detectedAt ? hhmm(c.detectedAt) : "", c.notifiedAt ? hhmm(c.notifiedAt) : "",
        c.startedAt ? hhmm(c.startedAt) : "", c.finishedAt ? hhmm(c.finishedAt) : "",
        c.inspectedAt ? hhmm(c.inspectedAt) : "",
        c.m1 ?? "", c.cycle ?? "",
      ].join(";")
    ),
  ].join("\n");

  return (
    <>
      <Refresher seconds={30} />
      <PageHeader
        kicker="UC-07 · el relevo sin oralidad"
        title="Cierre de turno"
        desc="El informe se arma desde la caja negra, no de la memoria: movimientos, ciclos devueltos al sistema, pendientes que se heredan e incidencias. El relevo opera sin llamada telefónica."
        actions={
          <ActionButton op="close_shift" label="Cerrar turno ahora" variant="primary" icon={<FileText size={13} />}
            confirmText="Se generará el informe desde el registro (inmutable) y quedará heredado al relevo. ¿Cerrar turno?" />
        }
      />

      <div className="rise grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { l: "eventos en la ventana", v: String(t.windowEvents.length), tone: "text-white" },
          { l: "ciclos completados", v: String(t.completedInWindow.length), tone: "text-emerald-300" },
          { l: "M1 promedio", v: m1avg !== null ? `${m1avg} min` : "—", tone: "text-amber-300" },
          { l: "M2 promedio", v: m2avg !== null ? duration(m2avg) : "—", tone: "text-violet-300" },
          { l: "pendientes heredados", v: String(inheritedTotal), tone: inheritedTotal ? "text-rose-300" : "text-white" },
        ].map((s) => (
          <Panel key={s.l} className="px-4 py-3">
            <div className="mono text-[9px] uppercase tracking-[0.16em] text-slate-500">{s.l}</div>
            <div className={`mt-1 text-[20px] font-bold tabular-nums ${s.tone}`}>{s.v}</div>
          </Panel>
        ))}
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        {/* detalle de la ventana */}
        <Panel className="rise rise-1 xl:col-span-2">
          <PanelTitle icon={<History size={14} />} title={`Ventana actual · últimas ${t.horizon} h`}
            sub="lo que entraría al informe si cerraras ahora"
            right={<ExportButton filename="cierre-turno.json" label="Exportar" data={JSON.stringify({ generado: now.toISOString(), ciclos: t.completedInWindow, heredados: t.inherited, por_tipo: t.kindCount }, null, 2)} />} />
          <div className="grid gap-0 md:grid-cols-2">
            <div className="border-b hairline md:border-b-0 md:border-r">
              <div className="mono px-4 pt-3 text-[9.5px] uppercase tracking-[0.18em] text-slate-500">movimientos por tipo</div>
              <div className="divide-y divide-white/[0.04] px-4 pb-2">
                {Object.entries(t.kindCount).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                  <div key={k} className="flex items-center justify-between py-1.5 text-[11.5px]">
                    <span className="text-slate-300">{EVENT_KIND_LABEL[k] ?? k}</span>
                    <span className="mono text-slate-500">{n}</span>
                  </div>
                ))}
                {Object.keys(t.kindCount).length === 0 && <div className="py-3 text-[11px] text-slate-600">sin eventos en la ventana</div>}
              </div>
            </div>
            <div>
              <div className="mono px-4 pt-3 text-[9.5px] uppercase tracking-[0.18em] text-slate-500">camas devueltas al sistema</div>
              <div className="divide-y divide-white/[0.04] px-4 pb-2">
                {t.completedInWindow.length === 0 && <div className="py-3 text-[11px] text-slate-600">ningún ciclo cerrado en la ventana</div>}
                {t.completedInWindow.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-1.5 text-[11.5px]">
                    <span className="text-[11px]"><TaskLink code={c.code} /></span>
                    <span className="mono text-[10px] text-slate-500"><BedLink code={c.bedCode} className="text-[10px]" /> · M1 {c.m1 ?? "—"}m · {c.cycle !== null ? duration(c.cycle) : "—"}</span>
                  </div>
                ))}
              </div>
              <div className="mono border-t hairline px-4 pt-3 text-[9.5px] uppercase tracking-[0.18em] text-slate-500">se hereda al relevo</div>
              <div className="space-y-1.5 px-4 py-2.5">
                {inheritedTotal === 0 && <div className="text-[11px] text-slate-600">nada pendiente — turno redondo</div>}
                {t.inherited.tasks.map((x) => (
                  <div key={x.code} className="flex items-center gap-2 text-[11px] text-slate-300">
                    <PackageCheck size={11} className="text-sky-400" /> <TaskLink code={x.code} /> (<BedLink code={x.bedCode} />) <span className="mono text-[9.5px] text-slate-600">{x.status}</span>
                  </div>
                ))}
                {t.inherited.approvals.map((x) => (
                  <div key={x.code} className="flex items-center gap-2 text-[11px] text-slate-300">
                    <ArrowRight size={11} className="text-violet-400" /> {x.code}: {x.title}
                  </div>
                ))}
                {t.inherited.conflicts.map((x) => (
                  <div key={x.id} className="flex items-center gap-2 text-[11px] text-slate-300">
                    <ArrowRight size={11} className="text-rose-400" /> conflicto C-{x.id} sobre <BedLink code={x.bedCode} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        {/* columna: export oficial + informes previos */}
        <div className="flex flex-col gap-3">
          <Panel className="rise rise-2">
            <PanelTitle icon={<ExternalLink size={14} />} title="Exportación al software oficial" sub="UC-09 · sin datos clínicos, reproducible" />
            <div className="p-3">
              <pre className="mono max-h-40 overflow-auto rounded-lg border hairline bg-black/40 p-3 text-[9px] leading-relaxed text-slate-500">{exportRows}</pre>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className="mono text-[9px] text-slate-600">formato separado por «;» — mapeable a carga oficial</span>
                <ExportButton filename="ciclos-camas.csv" label="CSV" mime="text/csv" data={exportRows} />
              </div>
            </div>
          </Panel>

          <Panel className="rise rise-2">
            <PanelTitle icon={<FileText size={14} />} title="Informes emitidos" sub="cada cierre queda guardado" />
            {t.reports.length === 0 ? (
              <EmptyState icon={<FileText size={17} />} title="Aún no hay cierres" desc="Al cerrar el turno, el informe queda guardado con su hora, autor y contenido." />
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {t.reports.map((r) => {
                  const totals = (r.content as { totals?: Record<string, number | null> }).totals ?? {};
                  return (
                    <div key={r.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[12px] font-semibold text-white">{r.label}</div>
                        <ExportButton filename={`turno-${r.id}.json`} label="JSON" data={JSON.stringify(r, null, 2)} />
                      </div>
                      <div className="mono mt-1 text-[9.5px] text-slate-600">
                        {r.generatedBy} · {dayTime(r.generatedAt)} · ventana {r.horizonHours} h
                      </div>
                      <div className="mono mt-1.5 flex flex-wrap gap-x-3 text-[10px] text-slate-500">
                        <span>{totals.eventos ?? 0} eventos</span>
                        <span>{totals.ciclos_completados ?? 0} ciclos</span>
                        <span>M1 {totals.m1_promedio ?? "—"}m</span>
                        <span>M2 {totals.m2_promedio ? duration(totals.m2_promedio) : "—"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel className="rise rise-3">
            <PanelTitle icon={<History size={14} />} title="Últimos movimientos" sub="caja negra · ventana de turno" />
            <div className="max-h-64 divide-y divide-white/[0.04] overflow-y-auto">
              {t.windowEvents.slice(0, 10).map((e) => (
                <div key={e.id} className="flex gap-2.5 px-4 py-2">
                  <EventDot kind={e.kind} />
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-snug text-slate-300">{e.summary}</div>
                    <div className="mono mt-0.5 text-[9px] text-slate-600">{ago(e.ts, now)}{e.bedCode ? ` · ${e.bedCode}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
