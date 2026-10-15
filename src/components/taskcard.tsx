import { TimerReset, Pause } from "lucide-react";
import Link from "next/link";
import type { TaskView } from "@/lib/queries";
import type { TaskStatus } from "@/lib/domain";
import { getRules } from "@/lib/config";
import { ago, duration, minutesBetween, hhmm } from "@/lib/time";
import { TaskStateBadge, PriorityChip, TaskPipeline } from "@/components/ui";
import { ActionButton, ReasonButton } from "@/components/client";
import { BedLink, TaskLink, ChannelBadge } from "@/components/links";

export default async function TaskCard({ t, now, detail = false }: { t: TaskView; now: Date; detail?: boolean }) {
  const R = await getRules();
  const waited = t.notifiedAt && !t.acceptedAt ? minutesBetween(t.notifiedAt, now) : null;
  const slaBreach = waited !== null && waited > R.CLEANING_ACCEPT_SLA_MIN;
  const status = t.status as TaskStatus;
  const closed = status === "completed" || status === "cancelled";

  return (
    <div className={`panel p-4 ${t.priority === "critica" ? "border-red-300 bg-red-50/30" : t.priority === "alta" ? "border-amber-300 bg-amber-50/30" : ""}`}>
      <div className="flex flex-wrap items-center gap-2.5">
        {detail ? (
          <span className="mono text-[14px] font-bold text-[var(--color-text)]">{t.code}</span>
        ) : (
          <span className="text-[13px]"><TaskLink code={t.code} /></span>
        )}
        <PriorityChip priority={t.priority} />
        <TaskStateBadge status={status} />
        <ChannelBadge channel={t.channel} size="sm" />
        <span className="text-[11px] text-[var(--color-text-secondary)]">
          <BedLink code={t.bedCode} /> · {t.unit} · {t.estCode}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {waited !== null && (
            <span className={`mono flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${slaBreach ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>
              <TimerReset size={11} /> esperando aseo {duration(waited)}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3"><TaskPipeline status={status} /></div>

      <div className="mono mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] text-[var(--color-text-muted)] sm:grid-cols-4">
        <div>alta detectada<br /><span className="text-[var(--color-text)]">{t.detectedAt ? `${hhmm(t.detectedAt)} · ${ago(t.detectedAt, now)}` : "—"}</span></div>
        <div>aviso a aseo<br /><span className={t.notifiedAt ? "text-amber-700" : "text-[var(--color-text-muted)]"}>{t.notifiedAt ? `${hhmm(t.notifiedAt)} · ${ago(t.notifiedAt, now)}` : "pendiente"}</span></div>
        <div>tomada / inicio<br /><span className="text-[var(--color-text)]">{t.startedAt ? `${hhmm(t.startedAt)} · ${ago(t.startedAt, now)}` : t.acceptedAt ? `${hhmm(t.acceptedAt)} · ${ago(t.acceptedAt, now)}` : "—"}</span></div>
        <div>término<br /><span className="text-[var(--color-text)]">{t.finishedAt ? `${hhmm(t.finishedAt)} · ${ago(t.finishedAt, now)}` : "—"}</span></div>
      </div>

      {t.blockedReason && (
        <div className="mono mt-2 flex items-center gap-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[10.5px] text-red-700">
          <Pause size={11} /> impedimento: {t.blockedReason}
        </div>
      )}
      {t.cancelReason && (
        <div className="mono mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10.5px] text-[var(--color-text-muted)]">anulada: {t.cancelReason}</div>
      )}

      {!closed && (
        <div className="mt-3.5 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-3">
          {status === "notified" && (
            <>
              <ActionButton op="task" params={{ taskId: t.id, taskOp: "accept" }} label="Aseo la tomó" size="sm" variant="sky" confirmText={`Confirma solo si aseo tomó ${t.code}.`} />
              <ReasonButton op="task" params={{ taskId: t.id, taskOp: "block" }} label="Impedimento" size="sm" variant="ghost" promptText="¿Qué impide tomar esta limpieza?" />
            </>
          )}
          {status === "accepted" && (
            <>
              <ActionButton op="task" params={{ taskId: t.id, taskOp: "start" }} label="Iniciar limpieza" size="sm" variant="sky" />
              <ReasonButton op="task" params={{ taskId: t.id, taskOp: "block" }} label="Impedimento" size="sm" variant="ghost" promptText="¿Qué impide continuar?" />
            </>
          )}
          {status === "cleaning" && (
            <>
              <ActionButton op="task" params={{ taskId: t.id, taskOp: "finish" }} label="Aseo terminó" size="sm" variant="primary" confirmText="Se propondrá tu inspección humana (R2)." />
              <ReasonButton op="task" params={{ taskId: t.id, taskOp: "block" }} label="Impedimento" size="sm" variant="ghost" promptText="¿Qué impide continuar?" />
            </>
          )}
          {status === "blocked" && (
            <ActionButton op="task" params={{ taskId: t.id, taskOp: "unblock" }} label="Retomar" size="sm" variant="primary" />
          )}
          {status === "pending_inspection" && (
            <Link href="/aprobaciones" className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1.5 text-[11px] font-semibold text-orange-700 transition hover:bg-orange-100">
              <TimerReset size={12} /> Tu inspección → Aprobaciones
            </Link>
          )}
          {status !== "pending_inspection" && (
            <ReasonButton op="task" params={{ taskId: t.id, taskOp: "cancel" }} label="Anular" size="sm" variant="danger" promptText="Motivo de la anulación:" />
          )}
        </div>
      )}
    </div>
  );
}
