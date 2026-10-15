import {
  BedDouble,
  Timer,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Activity,
  Radio,
  ScrollText,
  ArrowRight,
  HelpCircle,
  PhoneOff,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { loadBeds, loadTasks, loadApprovals, loadConflicts, loadEvents } from "@/lib/queries";
import { computeMetrics } from "@/lib/metrics";
import { getRules } from "@/lib/config";
import { BED_STATE_META, BED_STATUSES, APPROVAL_KIND_LABEL, EVENT_KIND_LABEL } from "@/lib/domain";
import { ago, duration, longDate } from "@/lib/time";
import { PageHeader, Panel, PanelTitle, Stat, BedStateBadge, ApprovalKindChip, EmptyState, EventDot, Bars } from "@/components/ui";
import { ActionButton, ApproveRejectButtons, Refresher } from "@/components/client";
import { BedLink, TaskLink } from "@/components/links";

export const dynamic = "force-dynamic";

function greeting(now: Date): string {
  const h = now.getHours();
  if (h >= 6 && h < 13) return "Buenos días";
  if (h >= 13 && h < 20) return "Buenas tardes";
  return "Buenas noches";
}

export default async function Tablero() {
  const now = new Date();
  const [rules, { beds, ests }, { active: activeTasks }, { pending: pendingApprovals }, { open: openConflicts }, { events: recent }, m] =
    await Promise.all([
      getRules(),
      loadBeds(now),
      loadTasks(now),
      loadApprovals(now),
      loadConflicts(now),
      loadEvents(now, 9),
      computeMetrics(now),
    ]);

  const freshAvailable = beds.filter((b) => b.status === "available" && !b.stale);
  const staleAvailable = beds.filter((b) => b.status === "available" && b.stale);
  const moving = beds.filter((b) => b.status !== "occupied" || b.stale || b.openConflictId !== null);
  const escalatedTasks = activeTasks.filter((t) => t.priority !== "normal");
  const staleBeds = beds.filter((b) => b.stale);

  const counts = new Map<string, number>();
  for (const b of beds) counts.set(b.effectiveStatus, (counts.get(b.effectiveStatus) ?? 0) + 1);
  const total = beds.length;

  const perEst = ests.map((e) => {
    const eb = beds.filter((b) => b.estCode === e.code);
    return {
      ...e,
      total: eb.length,
      disponibles: eb.filter((b) => b.status === "available" && !b.stale).length,
      ciclo: eb.filter((b) => ["pending_cleaning", "cleaning", "cleaning_completed", "pending_inspection"].includes(b.status)).length,
      ocupadas: eb.filter((b) => ["occupied", "reserved", "blocked"].includes(b.status)).length,
    };
  });

  return (
    <>
      <Refresher seconds={25} />
      <PageHeader
        kicker={`${longDate(now)} · auxiliar / paralelo / autorizado`}
        title={`${greeting(now)}, ${rules.TURNO_ACTOR.split(" ").pop()}`}
        desc={`${freshAvailable.length} camas libres confirmadas · ${activeTasks.length} ciclos de aseo corriendo · ${pendingApprovals.length} propuesta${pendingApprovals.length !== 1 ? "s" : ""} esperándote · ${openConflicts.length} conflicto${openConflicts.length !== 1 ? "s" : ""}. Todo queda en la caja negra con actor, hora y fuente.`}
        actions={
          <>
            <ActionButton op="capacity_query" label="Responder «¿tenís cama?»" icon={<PhoneOff size={13} />} variant="sky"
              confirmText="El sistema responderá con el tablero REAL: disponibles confirmadas, vencidas y en ciclo — sin interrumpir al humano. ¿Ejecutar?" />
            <Link href="/bandeja" className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-3.5 py-2 text-[12px] font-medium text-slate-300 ring-1 ring-white/10 transition hover:bg-white/[0.08]">
              <Radio size={13} /> Ir a la bandeja
            </Link>
          </>
        }
      />

      {/* ---------------- KPIs ---------------- */}
      <div className="rise grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Disponibles" value={String(freshAvailable.length)} tone="ok" icon={<BedDouble size={13} />}
          sub={staleAvailable.length > 0 ? `+${staleAvailable.length} con dato vencido` : "todas con dato confirmado"} />
        <Stat label="M1 · alta→aviso" value={m.m1.avg !== null ? `${m.m1.avg} min` : "—"} tone={m.m1.avg !== null && m.m1.avg <= 10 ? "ok" : "warn"} icon={<Timer size={13} />}
          sub={m.m1.n ? `promedio · ${m.m1.n} ciclos (meta < 10)` : "aún sin ciclos hoy"} />
        <Stat label="M2 · ciclo completo" value={m.m2.avg !== null ? duration(m.m2.avg) : "—"} tone="violet" icon={<Activity size={13} />}
          sub={m.m2.n ? `${m.m2.n} camas devueltas al sistema` : "aún sin ciclos completos"} />
        <Stat label="Esperándote" value={String(pendingApprovals.length)} tone={pendingApprovals.length ? "warn" : "default"} icon={<ShieldCheck size={13} />}
          sub="propuestas que no se aplican solas" />
        <Stat label="Conflictos" value={String(openConflicts.length)} tone={openConflicts.length ? "danger" : "default"} icon={<AlertTriangle size={13} />}
          sub="fuentes en contradicción · congeladas" />
        <Stat label="Fuera de SLA" value={String(m.m4.overdue)} tone={m.m4.overdue ? "danger" : "default"} icon={<Flame size={13} />}
          sub={`limpieza sin moverse > ${rules.CLEANING_ACCEPT_SLA_MIN} min`} />
      </div>

      {/* ---------------- capacidad de la red ---------------- */}
      <Panel className="rise rise-1 mt-3">
        <PanelTitle icon={<Activity size={14} />} title="Capacidad de la red" sub={`${total} camas registradas · distribución por establecimiento y estado`}
          right={<Link href="/camas" className="group flex items-center gap-1 text-[11px] font-medium text-teal-300 transition hover:text-teal-200">tablero completo <ArrowRight size={12} className="transition group-hover:translate-x-0.5" /></Link>} />
        <div className="grid gap-0 md:grid-cols-3">
          {perEst.map((e, i) => (
            <Link key={e.id} href={`/camas?est=${e.code}`}
              className={`group px-5 py-4 transition hover:bg-white/[0.02] ${i < perEst.length - 1 ? "border-b hairline md:border-b-0 md:border-r" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-white">{e.code}</span>
                    <ArrowUpRight size={11} className="text-slate-600 transition group-hover:text-teal-300" />
                  </div>
                  <div className="text-[10.5px] text-slate-500">{e.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-[20px] font-bold tabular-nums text-emerald-300">{e.disponibles}</div>
                  <div className="mono text-[9px] uppercase tracking-wider text-slate-500">libres</div>
                </div>
              </div>
              <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                {[
                  { n: e.disponibles, c: "#34d399" },
                  { n: e.ciclo, c: "#38bdf8" },
                  { n: e.ocupadas, c: "#3f4a5c" },
                  { n: Math.max(0, e.total - e.disponibles - e.ciclo - e.ocupadas), c: "#eab308" },
                ].map((s, j) =>
                  s.n > 0 ? <div key={j} className="h-full rounded-full" style={{ width: `${(s.n / e.total) * 100}%`, background: s.c }} /> : null
                )}
              </div>
              <div className="mono mt-2 flex gap-3 text-[9.5px] text-slate-500">
                <span>{e.total} camas</span>
                <span className="text-sky-300/80">{e.ciclo} en ciclo</span>
                <span>{e.ocupadas} ocup./res./bloq.</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="border-t hairline px-5 py-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {BED_STATUSES.map((s) => {
              const n = counts.get(s) ?? 0;
              if (!n) return null;
              return (
                <Link key={s} href={`/camas?estado=${s}`} className="flex items-center gap-1.5 text-[11px] text-slate-400 transition hover:text-slate-200">
                  <span className={`h-1.5 w-1.5 rounded-full ${BED_STATE_META[s].dot}`} />
                  {BED_STATE_META[s].short} <span className="mono text-slate-500">{n}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </Panel>

      {/* ---------------- fila principal ---------------- */}
      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Panel className="rise rise-1 xl:col-span-2">
          <PanelTitle icon={<Activity size={14} />} title="Camas en movimiento" sub="todo lo que NO está en reposo — click en la cama para su detalle completo"
            right={<span className="mono text-[10px] text-slate-500">{moving.length} frentes</span>} />
          {moving.length === 0 ? (
            <EmptyState icon={<BedDouble size={17} />} title="Sin frentes abiertos" desc="Toda la red está en reposo. El copiloto sigue leyendo el correo y la mensajería en paralelo." />
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {moving.slice(0, 9).map((b) => (
                <div key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 transition hover:bg-white/[0.02]">
                  <div className="min-w-[130px]">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px]"><BedLink code={b.code} /></span>
                      {b.openConflictId !== null && (
                        <Link href={`/conflictos`} title={`Conflicto C-${b.openConflictId}`}><AlertTriangle size={12} className="text-rose-400" /></Link>
                      )}
                    </div>
                    <div className="text-[10.5px] text-slate-500">{b.unit} · {b.estCode}</div>
                  </div>
                  <BedStateBadge status={b.effectiveStatus} stale={false} />
                  <div className="mono text-[10.5px] text-slate-500">{duration(b.minutesInStatus)} en este estado</div>
                  <div className="ml-auto flex items-center gap-2">
                    {b.activeTaskCode && <TaskLink code={b.activeTaskCode} />}
                    {b.status === "available" && !b.stale && (
                      <ActionButton op="bed" params={{ bedId: b.id, bedOp: "reserve", reason: "reserva desde tablero" }} label="Reservar" size="sm" variant="primary"
                        confirmText={`¿Reservar ${b.code}? La promesa quedará registrada con tu nombre (dato confirmado ${ago(b.lastConfirmedAt, now)}).`} />
                    )}
                    {b.stale && (
                      <ActionButton op="bed" params={{ bedId: b.id, bedOp: "reconfirm" }} label="Reconfirmar" size="sm" variant="warn"
                        confirmText={`¿Verificaste en terreno ${b.code}? Solo confirma si realmente lo viste.`} />
                    )}
                    {b.status === "unknown" && !b.stale && (
                      <span className="mono text-[10px] text-fuchsia-300">pendiente de terreno</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {moving.length > 9 && (
            <div className="border-t hairline px-5 py-2.5 text-center">
              <Link href="/camas" className="text-[11px] text-slate-400 transition hover:text-slate-200">ver las {moving.length} completas →</Link>
            </div>
          )}
        </Panel>

        <div className="flex flex-col gap-3">
          <Panel className="rise rise-2">
            <PanelTitle icon={<ShieldCheck size={14} />} title="Esperándote" sub="nada se aplica sin tu decisión (R1)"
              right={<Link href="/aprobaciones" className="text-[10.5px] text-violet-300 transition hover:text-violet-200">ver todas →</Link>} />
            {pendingApprovals.length === 0 ? (
              <EmptyState icon={<ShieldCheck size={17} />} title="Sin propuestas pendientes" desc="El sistema sigue detectando y proponiendo; cada propuesta llega aquí con su motivo y su vencimiento." />
            ) : (
              <div className="space-y-3 p-3">
                {pendingApprovals.slice(0, 3).map((a) => {
                  const minsLeft = Math.round((a.expiresAt.getTime() - now.getTime()) / 60000);
                  return (
                    <div key={a.id} className="rounded-xl border border-violet-400/20 bg-violet-400/[0.04] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <ApprovalKindChip kind={a.kind} label={APPROVAL_KIND_LABEL[a.kind] ?? a.kind} />
                        <span className={`mono text-[9.5px] ${minsLeft < 10 ? "text-amber-300" : "text-slate-500"}`}>vence en {minsLeft} min</span>
                      </div>
                      <div className="mt-2 text-[12.5px] font-semibold leading-snug text-white">{a.title}</div>
                      <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">{a.detail}</div>
                      {a.bedCode && <div className="mt-1.5 text-[11px]"><BedLink code={a.bedCode} /></div>}
                      <div className="mt-3">
                        <ApproveRejectButtons approvalId={a.id}
                          approveLabel={a.kind === "inspection_approval" ? "Inspección OK, dejar disponible" : a.kind === "reply_draft" ? "Aprobar y enviar" : "Confirmar alta"}
                          rejectLabel={a.kind === "reply_draft" ? "Descartar borrador" : "Aún no"} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel className="rise rise-2">
            <PanelTitle icon={<Flame size={14} />} title="Proactivo — el sistema habla primero" sub="atrasos, vencimientos y contradicciones (UC-04)" />
            <div className="divide-y divide-white/[0.04]">
              {escalatedTasks.length === 0 && staleBeds.length === 0 && openConflicts.length === 0 && (
                <EmptyState icon={<Activity size={17} />} title="Nada escalado" desc="Los avisos corren dentro de plazo y los datos están frescos. El ruido se mide para no volverse alarma (G3)." />
              )}
              {escalatedTasks.map((t) => (
                <Link key={t.id} href={`/limpieza/${encodeURIComponent(t.code)}`} className="flex items-start gap-3 px-4 py-3 transition hover:bg-white/[0.02]">
                  <Flame size={14} className={t.priority === "critica" ? "mt-0.5 text-rose-400" : "mt-0.5 text-amber-400"} />
                  <div>
                    <div className="text-[12px] font-semibold text-slate-100">{t.code} sin aceptación — {t.priority.toUpperCase()}</div>
                    <div className="text-[10.5px] text-slate-500">
                      {t.bedCode} · {t.unit} · aviso salió {t.notifiedAt ? ago(t.notifiedAt, now) : "—"} · supera el SLA de {rules.CLEANING_ACCEPT_SLA_MIN} min
                    </div>
                  </div>
                </Link>
              ))}
              {openConflicts.map((c) => (
                <Link key={c.id} href="/conflictos" className="flex items-start gap-3 px-4 py-3 transition hover:bg-white/[0.02]">
                  <AlertTriangle size={14} className="mt-0.5 text-rose-400" />
                  <div>
                    <div className="text-[12px] font-semibold text-slate-100">Conflicto C-{c.id} sobre <BedLink code={c.bedCode} /></div>
                    <div className="text-[10.5px] text-slate-500">{c.sourceA} dice «{labelDe(c.valueA)}» · {c.sourceB} dice «{labelDe(c.valueB)}» — congelado</div>
                  </div>
                </Link>
              ))}
              {staleBeds.slice(0, 3).map((b) => (
                <div key={b.id} className="flex items-start gap-3 px-4 py-3">
                  <HelpCircle size={14} className="mt-0.5 text-yellow-400" />
                  <div className="flex-1">
                    <div className="text-[12px] font-semibold text-slate-100"><BedLink code={b.code} /> con dato vencido</div>
                    <div className="text-[10.5px] text-slate-500">{b.unit} · sin confirmación humana {ago(b.lastConfirmedAt, now)} — reconfirmar antes de operarla</div>
                  </div>
                  <ActionButton op="bed" params={{ bedId: b.id, bedOp: "reconfirm" }} label="Verifiqué" size="sm" variant="warn"
                    confirmText={`¿Verificaste en terreno ${b.code}? Quedará como confirmado por ti.`} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* ---------------- fila secundaria ---------------- */}
      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Panel className="rise rise-2">
          <PanelTitle icon={<Activity size={14} />} title="Actividad de hoy por hora" sub="eventos registrados en la caja negra" />
          <div className="px-4 pb-4 pt-3">
            <Bars data={m.series.hourly.filter((_, h) => h % 2 === 0).map((b) => ({ label: b.hour, value: b.count }))} />
          </div>
        </Panel>

        <Panel className="rise rise-3">
          <PanelTitle icon={<Timer size={14} />} title="Ciclos devueltos al sistema" sub="minutos alta → disponible por tarea (M2)"
            right={<Link href="/metricas" className="text-[10.5px] text-teal-300 transition hover:text-teal-200">métricas →</Link>} />
          <div className="px-4 pb-4 pt-3">
            {m.series.cycles.length === 0 ? (
              <EmptyState icon={<Timer size={17} />} title="Sin ciclos completos" desc="Cuando una cama complete alta→limpieza→inspección→disponible, su curva aparece aquí." />
            ) : (
              <Bars tone="violet" unit="m" data={m.series.cycles.map((c) => ({ label: c.label, value: c.mins }))} />
            )}
            <div className="mono mt-2 border-t hairline pt-2 text-[9.5px] uppercase tracking-wider text-slate-600">
              línea base manual: pendiente de medir · docs/METRICAS-BASE.md
            </div>
          </div>
        </Panel>

        <Panel className="rise rise-3">
          <PanelTitle icon={<ScrollText size={14} />} title="Caja negra en vivo" sub="append-only · no se edita ni se borra (R6)"
            right={<Link href="/registro" className="text-[10.5px] text-teal-300 transition hover:text-teal-200">todo →</Link>} />
          <div className="max-h-[300px] divide-y divide-white/[0.04] overflow-y-auto">
            {recent.map((e) => (
              <div key={e.id} className="flex gap-3 px-4 py-2.5">
                <EventDot kind={e.kind} />
                <div className="min-w-0">
                  <div className="text-[11.5px] leading-snug text-slate-200">{e.summary}</div>
                  <div className="mono mt-1 flex flex-wrap items-center gap-x-2 text-[9px] uppercase tracking-wider text-slate-600">
                    <span>{ago(e.ts, now)}</span>
                    <span className="text-slate-500">{EVENT_KIND_LABEL[e.kind] ?? e.kind}</span>
                    <span>actor: {e.actor}</span>
                    {e.bedCode && <BedLink code={e.bedCode} className="text-[9px]" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

function labelDe(v: string): string {
  return (BED_STATE_META[v as keyof typeof BED_STATE_META]?.short ?? v).toLowerCase();
}
