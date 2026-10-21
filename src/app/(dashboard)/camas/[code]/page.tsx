import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  ShieldCheck,
  ScrollText,
  History,
  Inbox,
  Building2,
  Tag,
  Clock3,
  UserCheck,
  PackageCheck,
} from "lucide-react";
import { loadBedDetail } from "@/lib/queries";
import { BED_TYPE_LABEL, EVENT_KIND_LABEL, APPROVAL_KIND_LABEL, MESSAGE_CLASSIFICATIONS } from "@/lib/domain";
import { ago, dayTime, duration, minutesBetween, hhmm } from "@/lib/time";
import { Panel, PanelTitle, BedStateBadge, ApprovalKindChip, EventDot, EmptyState } from "@/components/ui";
import { ApproveRejectButtons, Refresher } from "@/components/client";
import { TaskLink, ChannelBadge, MessageRef } from "@/components/links";
import BedActions from "@/components/bedactions";
import TaskCard from "@/components/taskcard";

export const dynamic = "force-dynamic";

export default async function BedDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const now = new Date();
  const data = await loadBedDetail(decodeURIComponent(code), now);
  if (!data) notFound();

  const { bed: b, est, staleHours, activeTask, closedTasks, pendingApprovals, recentApprovals, openConflicts, resolvedConflicts, messages, events } = data;
  const allApprovals = [...pendingApprovals];

  return (
    <>
      <Refresher seconds={20} />
      {/* ---------- cabecera ---------- */}
      <div className="rise mb-5">
        <Link href="/camas" className="mono inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-slate-500 transition hover:text-slate-300">
          <ArrowLeft size={12} /> camas de la red
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="mono text-[30px] font-bold tracking-tight text-white">{b.code}</h1>
              <BedStateBadge status={b.effectiveStatus} />
              {b.openConflictId !== null && (
                <Link href="/conflictos" className="inline-flex items-center gap-1.5 rounded-md bg-rose-400/10 px-2 py-1 text-[10.5px] font-semibold text-rose-300 ring-1 ring-rose-400/30">
                  <AlertTriangle size={11} /> conflicto C-{b.openConflictId}
                </Link>
              )}
            </div>
            <div className="mono mt-1.5 text-[11px] text-slate-500">
              {b.unit} · {est?.name} ({b.estCode}) · tipo {BED_TYPE_LABEL[b.bedType] ?? b.bedType}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-right">
            {[
              { l: "en este estado", v: duration(b.minutesInStatus), icon: <Clock3 size={11} /> },
              { l: `última confirmación`, v: ago(b.lastConfirmedAt, now), icon: <UserCheck size={11} /> },
              { l: "frescura máxima", v: `${staleHours} h`, icon: <Tag size={11} /> },
            ].map((x) => (
              <div key={x.l} className="rounded-xl border hairline bg-white/[0.02] px-3 py-2">
                <div className="mono flex items-center justify-end gap-1 text-[8.5px] uppercase tracking-wider text-slate-600">{x.icon} {x.l}</div>
                <div className={`mono mt-0.5 text-[12.5px] font-semibold ${x.l.startsWith("última") && b.stale ? "text-yellow-300" : "text-slate-200"}`}>{x.v}</div>
              </div>
            ))}
          </div>
        </div>
        {b.note && (
          <div className="mono mt-3 rounded-lg border hairline bg-white/[0.02] px-3 py-2 text-[11px] text-slate-400">{b.note}</div>
        )}
        <div className="mt-4">
          <BedActions b={b} now={now} size="md" />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {/* ------- columna principal ------- */}
        <div className="space-y-3 xl:col-span-2">
          {/* ciclo activo */}
          <section className="rise rise-1">
            <div className="mono mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">ciclo de aseo</div>
            {activeTask ? (
              <TaskCard t={activeTask} now={now} />
            ) : (
              <Panel><EmptyState icon={<PackageCheck size={17} />} title="Sin ciclo de aseo activo" desc="Al confirmar un alta, el ciclo se abre y se avisa a aseo en el mismo movimiento, con todas sus marcas de tiempo." /></Panel>
            )}
          </section>

          {/* propuestas */}
          <section className="rise rise-2">
            <div className="mono mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
              propuestas que esperan tu decisión · {allApprovals.length}
            </div>
            {allApprovals.length === 0 ? (
              <Panel><EmptyState icon={<ShieldCheck size={17} />} title="Nada pendiente sobre esta cama" desc="Cuando el sistema detecte algo, la propuesta llegará aquí con motivo, fuente y vencimiento." /></Panel>
            ) : (
              <div className="space-y-3">
                {allApprovals.map((a) => {
                  const left = Math.round((a.expiresAt.getTime() - now.getTime()) / 60000);
                  return (
                    <Panel key={a.id} className="relative overflow-hidden p-4">
                      <div className="absolute inset-y-0 left-0 w-0.5 bg-violet-400/60" />
                      <div className="flex flex-wrap items-center gap-2">
                        <ApprovalKindChip kind={a.kind} label={APPROVAL_KIND_LABEL[a.kind] ?? a.kind} />
                        <span className="mono text-[10px] text-slate-500">{a.code}</span>
                        {a.taskCode && <TaskLink code={a.taskCode} />}
                        <span className={`mono ml-auto rounded-md px-2 py-1 text-[10px] ring-1 ${left < 10 ? "bg-amber-400/10 text-amber-300 ring-amber-400/30" : "bg-white/[0.03] text-slate-400 ring-white/10"}`}>
                          vence en {left} min
                        </span>
                      </div>
                      <h3 className="mt-2 text-[14px] font-bold text-white">{a.title}</h3>
                      <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{a.detail}</p>
                      <div className="mt-3">
                        <ApproveRejectButtons approvalId={a.id}
                          approveLabel={a.kind === "inspection_approval" ? "Inspección OK, dejar disponible" : "Confirmar alta"}
                          rejectLabel="Aún no" />
                      </div>
                    </Panel>
                  );
                })}
              </div>
            )}
          </section>

          {/* historial */}
          <section className="rise rise-3">
            <Panel>
              <PanelTitle icon={<ScrollText size={14} />} title={`Historia de ${b.code}`} sub="caja negra filtrada por esta cama — no se edita ni se borra"
                right={<Link href={`/registro?cama=${encodeURIComponent(b.code)}`} className="text-[10.5px] text-teal-300 transition hover:text-teal-200">abrir en caja negra →</Link>} />
              {events.length === 0 ? (
                <EmptyState icon={<History size={17} />} title="Sin eventos aún" desc="Cada detección, aviso, decisión y conflicto de esta cama quedará aquí con actor, hora y fuente." />
              ) : (
                <div className="max-h-[460px] divide-y divide-white/[0.04] overflow-y-auto">
                  {events.map((e) => (
                    <div key={e.id} className="flex gap-3 px-4 py-2.5">
                      <EventDot kind={e.kind} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11.5px] leading-snug text-slate-200">{e.summary}</div>
                        <div className="mono mt-1 flex flex-wrap items-center gap-x-2 text-[9px] uppercase tracking-wider text-slate-600">
                          <span className="text-slate-500">{dayTime(e.ts)}</span>
                          <span>{EVENT_KIND_LABEL[e.kind] ?? e.kind}</span>
                          <span>actor: {e.actor}</span>
                          <ChannelBadge channel={e.source} size="sm" />
                          {typeof (e.payload as { cycle_minutes?: unknown }).cycle_minutes === "number" && (
                            <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-emerald-300 ring-1 ring-emerald-400/30">
                              ciclo {String((e.payload as { cycle_minutes: number }).cycle_minutes)} min
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </section>
        </div>

        {/* ------- columna lateral ------- */}
        <div className="flex flex-col gap-3">
          <Panel className="rise rise-1">
            <PanelTitle icon={<Building2 size={14} />} title="Ficha operativa" sub="solo datos operativos — nada clínico" />
            <div className="divide-y divide-white/[0.04] px-4 py-1">
              {[
                ["Establecimiento", `${est?.name ?? b.estName} (${b.estCode})`],
                ["Unidad", b.unit],
                ["Tipo de cama", BED_TYPE_LABEL[b.bedType] ?? b.bedType],
                ["Estado desde", `${dayTime(b.statusSince)} · ${ago(b.statusSince, now)}`],
                ["Confirmación humana", `${dayTime(b.lastConfirmedAt)} · ${ago(b.lastConfirmedAt, now)}`],
                ["Dato vence a las", `${hhmm(new Date(b.lastConfirmedAt.getTime() + staleHours * 3600000))} (${staleHours} h)`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 py-2 text-[11.5px]">
                  <span className="text-slate-500">{k}</span>
                  <span className="mono text-right text-slate-200">{v}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="rise rise-2">
            <PanelTitle icon={<Inbox size={14} />} title="Mensajes vinculados" sub="correo / telegram ligados a esta cama" />
            {messages.length === 0 ? (
              <EmptyState icon={<Inbox size={17} />} title="Ninguno vinculado" desc="Cuando el copiloto vincule un correo o mensaje a esta cama, aparecerá aquí con su canal y estado." />
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {messages.map((m) => {
                  const cls = m.classification ? MESSAGE_CLASSIFICATIONS[m.classification] : null;
                  return (
                    <Link key={m.id} href={`/bandeja/${m.id}`} className="block px-4 py-2.5 transition hover:bg-white/[0.02]">
                      <div className="flex items-center gap-2">
                        <ChannelBadge channel={m.channel} size="sm" />
                        {cls && <span className={`text-[10px] font-semibold ${cls.text}`}>{cls.label}</span>}
                        <span className="mono ml-auto text-[9px] text-slate-600">{ago(m.receivedAt, now)}</span>
                      </div>
                      <div className="mt-1 truncate text-[11.5px] text-slate-300">{m.subject}</div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel className="rise rise-2">
            <PanelTitle icon={<History size={14} />} title="Ciclos anteriores" sub="historial de limpiezas de esta cama" />
            {closedTasks.length === 0 ? (
              <EmptyState icon={<History size={17} />} title="Sin ciclos cerrados" desc="Los ciclos completados mostrarán aquí su M1 y su tiempo total." />
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {closedTasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <TaskLink code={t.code} />
                    <span className={`mono text-[9.5px] ${t.status === "completed" ? "text-emerald-300" : "text-zinc-500"}`}>
                      {t.status === "completed" && t.closedAt
                        ? `M1 ${t.notifiedAt ? minutesBetween(t.detectedAt, t.notifiedAt) : "—"}m · ${duration(minutesBetween(t.detectedAt, t.closedAt))}`
                        : t.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {(recentApprovals.length > 0 || resolvedConflicts.length > 0) && (
            <Panel className="rise rise-3">
              <PanelTitle icon={<ShieldCheck size={14} />} title="Decisiones sobre esta cama" sub="quién, cuándo y con qué desenlace" />
              <div className="divide-y divide-white/[0.04]">
                {recentApprovals.map((a) => (
                  <div key={a.id} className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="mono text-[9.5px] text-slate-500">{a.code}</span>
                      <span className={`mono rounded px-1.5 py-0.5 text-[9px] font-semibold ring-1 ${
                        a.status === "approved" ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30"
                        : a.status === "rejected" ? "bg-slate-400/10 text-slate-300 ring-slate-400/30"
                        : a.status === "expired" ? "bg-amber-400/10 text-amber-300 ring-amber-400/30"
                        : "bg-orange-400/10 text-orange-300 ring-orange-400/30"}`}>{a.status}</span>
                      <span className="mono ml-auto text-[9px] text-slate-600">{a.decidedAt ? dayTime(a.decidedAt) : ""}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-300">{a.title}</div>
                    {a.decidedBy && <div className="mono mt-0.5 text-[9px] text-slate-600">por {a.decidedBy}{a.decisionReason ? ` · “${a.decisionReason}”` : ""}</div>}
                  </div>
                ))}
                {resolvedConflicts.map((c) => (
                  <div key={c.id} className="px-4 py-2.5">
                    <div className="text-[11px] text-slate-300">
                      Conflicto C-{c.id} resuelto → <span className="font-semibold text-emerald-300">{c.resolution}</span>
                    </div>
                    <div className="mono mt-0.5 text-[9px] text-slate-600">“{c.criterion}”</div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
