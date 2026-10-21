import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowLeftRight,
  Eye,
  FileText,
  Link2,
  MailCheck,
  PenLine,
  ScrollText,
  ShieldAlert,
  Fingerprint,
} from "lucide-react";
import { loadMessageDetail } from "@/lib/queries";
import { MESSAGE_CLASSIFICATIONS, MESSAGE_STATUS, EVENT_KIND_LABEL, APPROVAL_KIND_LABEL, BED_TYPE_LABEL } from "@/lib/domain";
import { ago, dayTime, minutesUntil } from "@/lib/time";
import { Panel, PanelTitle, EventDot, EmptyState, BedStateBadge, ApprovalKindChip, ApprovalStatusChip } from "@/components/ui";
import { ActionButton, ApproveRejectButtons, Refresher } from "@/components/client";
import { BedLink, ChannelBadge, BedChip } from "@/components/links";
import type { BedStatus } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function MessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = new Date();
  const data = await loadMessageDetail(Number(id), now);
  if (!data) notFound();

  const { msg, bed, est, approvals: msgApprovals, replies, parent, msgEvents, bedEvents } = data;
  const cls = msg.classification ? MESSAGE_CLASSIFICATIONS[msg.classification] : null;
  const isOut = msg.direction === "outbound";
  const extracted = msg.extracted as Record<string, unknown>;
  const pendingApproval = msgApprovals.find((a) => a.status === "pending");
  const canDraft = !isOut && msg.status !== "no_aplica" && msg.status !== "atendido" && !pendingApproval;
  const canProposeAlta = !isOut && msg.classification === "alta" && bed && bed.status === "occupied";

  return (
    <>
      <Refresher seconds={20} />
      <div className="rise mb-5">
        <Link href="/bandeja" className="mono inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-slate-500 transition hover:text-slate-300">
          <ArrowLeft size={12} /> bandeja del canal oficial
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <ChannelBadge channel={msg.channel} />
          <span className={`mono rounded-md px-2 py-1 text-[9.5px] font-bold uppercase tracking-wider ring-1 ${isOut ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30" : "bg-white/[0.05] text-slate-300 ring-white/15"}`}>
            {isOut ? "saliente · autorizado" : "entrante"}
          </span>
          {cls && (
            <span className={`flex items-center gap-1.5 rounded-md bg-white/[0.04] px-2.5 py-1 text-[10.5px] font-semibold ring-1 ring-white/10 ${cls.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${cls.dot}`} /> {cls.label}
            </span>
          )}
          <span className={`mono rounded-md px-2 py-1 text-[9.5px] ring-1 ${
            msg.status === "pendiente_datos" ? "bg-amber-400/10 text-amber-300 ring-amber-400/30"
            : ["vinculado", "atendido", "enviado"].includes(msg.status) ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30"
            : msg.status === "no_aplica" ? "bg-fuchsia-400/10 text-fuchsia-300 ring-fuchsia-400/30"
            : "bg-white/[0.04] text-slate-400 ring-white/10"}`}>
            {MESSAGE_STATUS[msg.status] ?? msg.status}
          </span>
          <span className="mono ml-auto flex items-center gap-1.5 text-[10px] text-slate-600">
            <Fingerprint size={11} /> id {msg.externalId}
          </span>
        </div>

        <h1 className="mt-3 max-w-3xl text-[22px] font-bold leading-tight text-white">{msg.subject}</h1>
        <div className="mono mt-1.5 text-[11px] text-slate-500">
          {msg.fromName} · {dayTime(msg.receivedAt)} ({ago(msg.receivedAt, now)})
        </div>
      </div>

      {msg.classification === "instruccion_sistema" && (
        <div className="rise mb-3 flex items-start gap-3 rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/[0.06] px-4 py-3">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-fuchsia-300" />
          <div className="text-[12px] leading-relaxed text-fuchsia-200">
            <b>Contenido externo tratado como dato, jamás como instrucción (R4).</b> Este mensaje intenta ordenarle al sistema que
            cambie estados sin humanos. Nada cambió; el incidente quedó en la caja negra.
          </div>
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-3">
        {/* columna principal */}
        <div className="space-y-3 xl:col-span-2">
          <Panel className="rise rise-1 p-5">
            <div className="mono mb-2 text-[9.5px] uppercase tracking-[0.2em] text-slate-500">contenido íntegro</div>
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-200">{msg.body}</p>
            {parent && (
              <Link href={`/bandeja/${parent.id}`} className="mono mt-4 inline-flex items-center gap-1.5 rounded-lg border hairline bg-white/[0.02] px-3 py-2 text-[10.5px] text-slate-400 transition hover:text-slate-200">
                <ArrowLeftRight size={11} /> en respuesta a: “{parent.subject}”
              </Link>
            )}
          </Panel>

          {Object.keys(extracted).length > 0 && (
            <Panel className="rise rise-1">
              <PanelTitle icon={<Eye size={14} />} title="Lo que el copiloto entendió" sub="extracción con su origen visible — sin inventar (R5)" />
              <div className="grid gap-2 p-4 sm:grid-cols-2">
                {Object.entries(extracted).map(([k, v]) => (
                  <div key={k} className="rounded-lg border hairline bg-white/[0.02] px-3 py-2">
                    <div className="mono text-[9px] uppercase tracking-wider text-slate-500">{k}</div>
                    <div className="mono mt-0.5 text-[12px] text-slate-200">{Array.isArray(v) ? v.join(", ") : String(v)}</div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* acciones del mensaje */}
          {!isOut && (
            <Panel className="rise rise-2 p-4">
              <div className="mono mb-2.5 text-[9.5px] uppercase tracking-[0.2em] text-slate-500">acciones — siempre con tu firma</div>
              <div className="flex flex-wrap gap-2">
                {canDraft && (
                  <ActionButton op="draft_reply" params={{ messageId: msg.id }} icon={<PenLine size={13} />} variant="primary"
                    label={Array.isArray(extracted.faltan) && extracted.faltan.length ? "Preparar solicitud de antecedentes" : "Preparar borrador de respuesta"}
                    confirmText="El copiloto redactará un borrador con datos verificables y lo dejará en Aprobaciones. Nada se envía sin tu firma (R1)." />
                )}
                {canProposeAlta && bed && (
                  <ActionButton op="bed" params={{ bedId: bed.id, bedOp: "propose_discharge" }} icon={<Eye size={13} />} variant="violet" label={`Proponer alta de ${bed.code}`}
                    confirmText={`Se propondrá el alta de ${bed.code} a partir de este mensaje. Tú confirmas y recién ahí sale el aviso a aseo.`} />
                )}
                {pendingApproval && (
                  <span className="mono rounded-lg bg-violet-400/10 px-3 py-2 text-[11px] text-violet-300 ring-1 ring-violet-400/30">
                    hay una propuesta tuya esperando abajo ↓
                  </span>
                )}
                {!canDraft && !canProposeAlta && !pendingApproval && (
                  <span className="text-[11.5px] text-slate-500">Este mensaje está en su estado final — su gestión quedó registrada.</span>
                )}
              </div>
            </Panel>
          )}

          {/* propuestas de este mensaje */}
          {msgApprovals.length > 0 && (
            <section className="rise rise-2 space-y-3">
              <div className="mono text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
                propuestas generadas · {msgApprovals.length}
              </div>
              {msgApprovals.map((a) => {
                const left = minutesUntil(a.expiresAt, now);
                const draft = (a.payload as { draftBody?: string }).draftBody;
                return (
                  <Panel key={a.id} className={`relative overflow-hidden p-4 ${a.status === "pending" ? "" : "opacity-80"}`}>
                    {a.status === "pending" && <div className="absolute inset-y-0 left-0 w-0.5 bg-violet-400/60" />}
                    <div className="flex flex-wrap items-center gap-2">
                      <ApprovalKindChip kind={a.kind} label={APPROVAL_KIND_LABEL[a.kind] ?? a.kind} />
                      <span className="mono text-[10px] text-slate-500">{a.code}</span>
                      <ApprovalStatusChip status={a.status} />
                      {a.status === "pending" && (
                        <span className={`mono ml-auto rounded-md px-2 py-1 text-[10px] ring-1 ${left < 10 ? "bg-amber-400/10 text-amber-300 ring-amber-400/30" : "bg-white/[0.03] text-slate-400 ring-white/10"}`}>
                          vence en {left} min
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-[13.5px] font-bold text-white">{a.title}</h3>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">{a.detail}</p>
                    {draft && (
                      <div className="mt-3 rounded-xl border hairline bg-black/30 p-3">
                        <div className="mono mb-1.5 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.18em] text-sky-300">
                          <MailCheck size={11} /> borrador — nada sale sin tu firma
                        </div>
                        <p className="text-[12px] leading-relaxed text-slate-300">{draft}</p>
                      </div>
                    )}
                    {a.status === "pending" ? (
                      <div className="mt-3">
                        <ApproveRejectButtons approvalId={a.id}
                          approveLabel={a.kind === "reply_draft" ? "Aprobar y enviar" : a.kind === "inspection_approval" ? "Inspección OK, dejar disponible" : "Confirmar alta"}
                          rejectLabel={a.kind === "reply_draft" ? "Descartar borrador" : "Aún no"} />
                      </div>
                    ) : (
                      <div className="mono mt-2 text-[9.5px] text-slate-600">
                        {a.decidedBy ? `${a.decidedBy} · ` : ""}{a.decidedAt ? dayTime(a.decidedAt) : ""}{a.outcomeNote ? ` · ${a.outcomeNote}` : ""}
                      </div>
                    )}
                  </Panel>
                );
              })}
            </section>
          )}

          {/* hilo de respuestas */}
          {replies.length > 0 && (
            <Panel className="rise rise-3">
              <PanelTitle icon={<FileText size={14} />} title="Respuestas enviadas en este hilo" sub="cada una autorizada por un humano, con constancia" />
              <div className="divide-y divide-white/[0.04]">
                {replies.map((r) => (
                  <div key={r.id} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ChannelBadge channel={r.channel} size="sm" />
                      <span className="mono text-[9.5px] text-slate-600">{dayTime(r.receivedAt)}</span>
                      <span className="mono ml-auto text-[9.5px] text-emerald-300/80">autorizó {r.handledBy}</span>
                    </div>
                    <div className="mt-1.5 text-[12.5px] font-semibold text-slate-200">{r.subject}</div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">{r.body}</p>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* columna lateral */}
        <div className="flex flex-col gap-3">
          <Panel className="rise rise-1">
            <PanelTitle icon={<Link2 size={14} />} title="Vinculación" sub="con qué entidad se relacionó este mensaje" />
            <div className="space-y-2.5 p-4">
              {bed ? (
                <div className="rounded-xl border hairline bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between">
                    <BedChip code={bed.code} />
                    <BedStateBadge status={bed.status as BedStatus} size="sm" />
                  </div>
                  <div className="mono mt-2 text-[10px] text-slate-500">{bed.unit} · {est?.name} · {BED_TYPE_LABEL[bed.bedType] ?? bed.bedType}</div>
                </div>
              ) : (
                <div className="rounded-xl border hairline bg-white/[0.02] px-3 py-2.5 text-[11.5px] leading-relaxed text-slate-400">
                  Sin cama vinculada. Si faltan datos, el sistema <b>pregunta</b> en vez de asumir (R5).
                </div>
              )}
              <div className="rounded-xl border hairline bg-white/[0.02] px-3 py-2.5">
                <div className="mono text-[9px] uppercase tracking-wider text-slate-500">canal y rol</div>
                <div className="mt-1 flex items-center gap-2"><ChannelBadge channel={msg.channel} size="sm" /></div>
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-500">
                  {msg.channel === "correo"
                    ? "El correo institucional es el canal oficial de acuerdos entre unidades: toda respuesta formal pasa por aquí con tu firma."
                    : "La mensajería es la capa de velocidad del turno: contexto y decisiones rápidas, nunca sustituye el registro ni la decisión formal."}
                </p>
              </div>
              {msg.handledBy && (
                <div className="rounded-xl border hairline bg-white/[0.02] px-3 py-2.5">
                  <div className="mono text-[9px] uppercase tracking-wider text-slate-500">gestionado por</div>
                  <div className="mono mt-1 text-[12px] text-slate-200">{msg.handledBy} · {msg.handledAt ? dayTime(msg.handledAt) : ""}</div>
                </div>
              )}
            </div>
          </Panel>

          <Panel className="rise rise-2">
            <PanelTitle icon={<ScrollText size={14} />} title="Seguimiento del mensaje" sub="cada paso de su gestión, en la caja negra" />
            {msgEvents.length === 0 ? (
              <EmptyState icon={<ScrollText size={17} />} title="Sin seguimiento aún" desc="Clasificación, vinculación, borradores y envíos de este mensaje aparecerán aquí." />
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {msgEvents.map((e) => (
                  <div key={e.id} className="flex gap-2.5 px-4 py-2.5">
                    <EventDot kind={e.kind} />
                    <div className="min-w-0">
                      <div className="text-[11px] leading-snug text-slate-200">{e.summary}</div>
                      <div className="mono mt-0.5 text-[9px] text-slate-600">{dayTime(e.ts)} · {EVENT_KIND_LABEL[e.kind] ?? e.kind} · {e.actor}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {bedEvents.length > 0 && (
            <Panel className="rise rise-3">
              <PanelTitle icon={<Eye size={14} />} title={`Contexto de ${bed?.code}`} sub="últimos eventos de la cama vinculada"
                right={bed ? <BedLink code={bed.code} className="text-[10px]" /> : undefined} />
              <div className="divide-y divide-white/[0.04]">
                {bedEvents.slice(0, 6).map((e) => (
                  <div key={e.id} className="px-4 py-2">
                    <div className="truncate text-[10.5px] leading-snug text-slate-300">{e.summary}</div>
                    <div className="mono mt-0.5 text-[8.5px] text-slate-600">{ago(e.ts, now)}</div>
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
