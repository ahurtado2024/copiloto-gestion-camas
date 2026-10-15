import { ShieldCheck, Hourglass, History, MailCheck } from "lucide-react";
import { loadApprovals } from "@/lib/queries";
import { APPROVAL_KIND_LABEL } from "@/lib/domain";
import { ago, dayTime, minutesUntil } from "@/lib/time";
import { PageHeader, Panel, PanelTitle, ApprovalKindChip, ApprovalStatusChip, EmptyState } from "@/components/ui";
import { ApproveRejectButtons, Refresher } from "@/components/client";
import { BedLink, TaskLink, MessageRef } from "@/components/links";
import type { ApprovalView } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AprobacionesPage() {
  const now = new Date();
  const { pending, recent } = await loadApprovals(now);

  return (
    <>
      <Refresher seconds={15} />
      <PageHeader
        kicker="R1 · human-in-the-loop"
        title="Aprobaciones"
        desc="El sistema propone con motivo, fuente y vencimiento. Tú decides. Si una propuesta caduca, se anula — y si la condición cambió, queda obsoleta y no se aplica jamás."
      />

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <div className="mono text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
            Esperándote · {pending.length}
          </div>
          {pending.length === 0 && (
            <Panel>
              <EmptyState icon={<ShieldCheck size={17} />} title="Nada espera tu decisión" desc="Cada propuesta del copiloto llega aquí primero. Ninguna escritura relevante ocurre sin tu autorización (R1/R2)." />
            </Panel>
          )}
          {pending.map((a) => (
            <PendingCard key={a.id} a={a} now={now} />
          ))}
        </div>

        <Panel className="rise rise-1 h-fit">
          <PanelTitle icon={<History size={14} />} title="Decisiones recientes" sub="identidad, hora y motivo — para siempre" />
          {recent.length === 0 ? (
            <EmptyState icon={<History size={17} />} title="Sin historia aún" desc="Aprobadas, rechazadas, vencidas y obsoletas quedarán aquí con su desenlace." />
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {recent.map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mono text-[10px] text-slate-500">{a.code}</span>
                    <ApprovalStatusChip status={a.status} />
                  </div>
                  <div className="mt-1.5 text-[12px] font-medium leading-snug text-slate-200">{a.title}</div>
                  <div className="mono mt-1 text-[9.5px] leading-relaxed text-slate-600">
                    {a.decidedBy ? `${a.decidedBy} · ` : ""}{a.decidedAt ? dayTime(a.decidedAt) : ""}
                    {a.decisionReason ? ` · “${a.decisionReason}”` : ""}
                    {a.outcomeNote ? ` · ${a.outcomeNote}` : ""}
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

function PendingCard({ a, now }: { a: ApprovalView; now: Date }) {
  const left = minutesUntil(a.expiresAt, now);
  const urgent = left < 10;
  const payload = a.payload as { draftBody?: string; detectedAt?: string; origin?: string; previousStatus?: string };

  return (
    <div className="panel panel-hover rise relative overflow-hidden p-4">
      <div className="absolute inset-y-0 left-0 w-0.5 bg-violet-400/60" />
      <div className="flex flex-wrap items-center gap-2">
        <ApprovalKindChip kind={a.kind} label={APPROVAL_KIND_LABEL[a.kind] ?? a.kind} />
        <span className="mono text-[10px] text-slate-500">{a.code}</span>
        {a.bedCode && <span className="text-[11px]"><BedLink code={a.bedCode} /></span>}
        {a.taskCode && <TaskLink code={a.taskCode} />}
        {a.messageId && <MessageRef id={a.messageId} label={a.messageExternalId ?? "ver mensaje"} />}
        <span className={`mono ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] ring-1 ${urgent ? "bg-amber-400/10 text-amber-300 ring-amber-400/30" : "bg-white/[0.03] text-slate-400 ring-white/10"}`}>
          <Hourglass size={11} /> vence en {left} min
        </span>
      </div>

      <h3 className="mt-2.5 text-[15px] font-bold text-white">{a.title}</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{a.detail}</p>

      {payload.origin && (
        <div className="mono mt-2 text-[10px] uppercase tracking-wider text-slate-600">
          fuente: {payload.origin}{payload.detectedAt ? ` · detectado ${ago(new Date(payload.detectedAt), now)}` : ""}
        </div>
      )}

      {payload.draftBody && (
        <div className="mt-3 rounded-xl border hairline bg-black/30 p-3">
          <div className="mono mb-1.5 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.18em] text-sky-300">
            <MailCheck size={11} /> borrador — nada sale sin tu firma
          </div>
          <p className="text-[12px] leading-relaxed text-slate-300">{payload.draftBody}</p>
        </div>
      )}

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <ApproveRejectButtons
          approvalId={a.id}
          approveLabel={a.kind === "inspection_approval" ? "Inspección OK, dejar disponible" : a.kind === "reply_draft" ? "Aprobar y enviar" : "Confirmar alta"}
          rejectLabel={a.kind === "reply_draft" ? "Descartar borrador" : "Aún no"}
        />
        <span className="mono text-[9.5px] text-slate-600">propuesta creada {dayTime(a.createdAt)}</span>
      </div>
    </div>
  );
}
