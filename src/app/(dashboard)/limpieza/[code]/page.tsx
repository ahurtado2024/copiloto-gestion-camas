import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ScrollText, ShieldCheck, Clock3 } from "lucide-react";
import { loadTaskDetail } from "@/lib/queries";
import { EVENT_KIND_LABEL, APPROVAL_KIND_LABEL } from "@/lib/domain";
import { ago, dayTime, duration, minutesBetween } from "@/lib/time";
import { Panel, PanelTitle, EventDot, EmptyState, ApprovalKindChip, ApprovalStatusChip } from "@/components/ui";
import { ApproveRejectButtons, Refresher } from "@/components/client";
import { BedLink, BedChip, ChannelBadge } from "@/components/links";
import TaskCard from "@/components/taskcard";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const now = new Date();
  const data = await loadTaskDetail(decodeURIComponent(code), now);
  if (!data) notFound();
  const { task: t, bed, approvals, events, slaMin } = data;

  const marks: { label: string; at: Date | null; tone?: string }[] = [
    { label: "alta detectada", at: t.detectedAt },
    { label: "tarea creada", at: t.createdAt },
    { label: "aviso a aseo", at: t.notifiedAt, tone: "text-amber-300" },
    { label: "aseo la tomó", at: t.acceptedAt },
    { label: "limpieza iniciada", at: t.startedAt },
    { label: "término informado", at: t.finishedAt },
    { label: "inspección validada", at: t.inspectedAt, tone: "text-emerald-300" },
    { label: "cierre", at: t.closedAt, tone: "text-emerald-300" },
  ];
  const intervals = [
    { l: "M1 detección→aviso", v: t.notifiedAt ? minutesBetween(t.detectedAt, t.notifiedAt) : null },
    { l: "aviso→aceptación", v: t.acceptedAt && t.notifiedAt ? minutesBetween(t.notifiedAt, t.acceptedAt) : null },
    { l: "trabajo de aseo", v: t.finishedAt && t.startedAt ? minutesBetween(t.startedAt, t.finishedAt) : null },
    { l: "término→inspección", v: t.inspectedAt && t.finishedAt ? minutesBetween(t.finishedAt, t.inspectedAt) : null },
    { l: "M2 ciclo total", v: t.closedAt ? minutesBetween(t.detectedAt, t.closedAt) : null },
  ];

  return (
    <>
      <Refresher seconds={20} />
      <div className="rise mb-5">
        <Link href="/limpieza" className="mono inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-slate-500 transition hover:text-slate-300">
          <ArrowLeft size={12} /> ciclo de limpieza
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="mono text-[24px] font-bold tracking-tight text-white">{t.code}</h1>
          <ChannelBadge channel={t.channel} />
          {bed && (
            <span className="text-[11px] text-slate-500">
              <BedLink code={t.bedCode} /> · {t.unit} · {t.estCode}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <div className="rise rise-1">
            <TaskCard t={t} now={now} detail />
          </div>

          <Panel className="rise rise-2">
            <PanelTitle icon={<Clock3 size={14} />} title="Métricas por etapa" sub={`R9 — SLA de aceptación configurado: ${slaMin} min`} />
            <div className="divide-y divide-white/[0.04] px-4 py-1">
              {intervals.map((i) => (
                <div key={i.l} className="flex items-center justify-between py-2.5 text-[12px]">
                  <span className="text-slate-400">{i.l}</span>
                  <span className={`mono font-semibold ${i.v === null ? "text-slate-600" : i.l.startsWith("M") ? "text-emerald-300" : "text-slate-200"}`}>
                    {i.v === null ? "pendiente" : duration(i.v)}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="rise rise-2">
            <PanelTitle icon={<ScrollText size={14} />} title="Seguimiento del ciclo" sub="caja negra filtrada por esta tarea" />
            {events.length === 0 ? (
              <EmptyState icon={<ScrollText size={17} />} title="Sin eventos" desc="Cada marca de tiempo de este ciclo quedará aquí." />
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {events.map((e) => (
                  <div key={e.id} className="flex gap-3 px-4 py-2.5">
                    <EventDot kind={e.kind} />
                    <div className="min-w-0">
                      <div className="text-[11.5px] leading-snug text-slate-200">{e.summary}</div>
                      <div className="mono mt-0.5 text-[9px] text-slate-600">{dayTime(e.ts)} · {EVENT_KIND_LABEL[e.kind] ?? e.kind} · {e.actor}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-3">
          {bed && (
            <Link href={`/camas/${encodeURIComponent(bed.code)}`} className="panel panel-hover rise rise-1 block p-4">
              <div className="mono text-[9.5px] uppercase tracking-[0.2em] text-slate-500">cama del ciclo</div>
              <div className="mt-2 flex items-center gap-2">
                <BedChip code={bed.code} />
              </div>
              <div className="mono mt-2 text-[10.5px] text-slate-500">{bed.unit} · estado actual: {bed.status}</div>
            </Link>
          )}

          <Panel className="rise rise-1">
            <PanelTitle icon={<Clock3 size={14} />} title="Marcas de tiempo" sub="el flujo nunca se salta etapas" />
            <div className="divide-y divide-white/[0.04] px-4 py-1">
              {marks.map((mk) => (
                <div key={mk.label} className="flex items-center justify-between py-2 text-[11.5px]">
                  <span className="text-slate-500">{mk.label}</span>
                  <span className={`mono ${mk.at ? (mk.tone ?? "text-slate-200") : "text-slate-600"}`}>
                    {mk.at ? `${dayTime(mk.at)}` : "pendiente"}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          {approvals.length > 0 && (
            <Panel className="rise rise-2">
              <PanelTitle icon={<ShieldCheck size={14} />} title="Propuestas de este ciclo" sub="inspecciones y sus desenlaces" />
              <div className="space-y-3 p-3">
                {approvals.map((a) => (
                  <div key={a.id} className="rounded-xl border hairline bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2">
                      <ApprovalKindChip kind={a.kind} label={APPROVAL_KIND_LABEL[a.kind] ?? a.kind} />
                      <ApprovalStatusChip status={a.status} />
                    </div>
                    <div className="mt-1.5 text-[11.5px] font-semibold text-slate-200">{a.title}</div>
                    {a.status === "pending" ? (
                      <div className="mt-2.5">
                        <ApproveRejectButtons approvalId={a.id} approveLabel="Inspección OK, dejar disponible" rejectLabel="Rechazar (vuelve a aseo)" />
                      </div>
                    ) : (
                      <div className="mono mt-1.5 text-[9px] text-slate-600">
                        {a.decidedBy} · {a.decidedAt ? dayTime(a.decidedAt) : ""}{a.decisionReason ? ` · “${a.decisionReason}”` : ""}
                      </div>
                    )}
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
