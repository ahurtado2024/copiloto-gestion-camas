import { Inbox, SendHorizontal, Database, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { loadMessages } from "@/lib/queries";
import { MESSAGE_CLASSIFICATIONS, MESSAGE_STATUS } from "@/lib/domain";
import { ago, dayTime } from "@/lib/time";
import { PageHeader, Panel, PanelTitle, EmptyState } from "@/components/ui";
import { SimulateInboundButton, SimulateRetryButton, Refresher } from "@/components/client";
import { ChannelBadge, channelBar } from "@/components/links";
import { MailSyncButton } from "./client";

export const dynamic = "force-dynamic";

type Msg = Awaited<ReturnType<typeof loadMessages>>[number];

export default async function BandejaPage({ searchParams }: { searchParams: Promise<{ canal?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const msgs = await loadMessages(now);
  const canal = sp.canal ?? null;

  const inbound = msgs.filter((m) => m.direction === "inbound");
  const filtered = canal ? msgs.filter((m) => m.channel === canal) : msgs;
  const correo = msgs.filter((m) => m.channel === "correo");
  const telegram = msgs.filter((m) => m.channel === "telegram");

  const href = (c: string | null) => (c ? `/bandeja?canal=${c}` : "/bandeja");

  return (
    <>
      <Refresher seconds={20} />
      <PageHeader
        kicker="UC-02 · cada mensaje se guarda, clasifica, vincula y deja constancia"
        title="Bandeja del canal oficial"
        desc="Idempotencia garantizada, extracción visible y respuestas siempre como borrador + tu firma. Click en cualquier mensaje para abrir su detalle: gestión completa, seguimiento e hilo."
        actions={
          <>
            <MailSyncButton />
            <SimulateInboundButton />
            <SimulateRetryButton />
          </>
        }
      />

      {/* separación de canales */}
      <div className="rise mb-4 grid gap-3 md:grid-cols-2">
        <ChannelLane
          canal="correo" active={canal === "correo"} href={href("correo")}
          title="Correo institucional" desc="canal oficial de acuerdos entre unidades — toda respuesta formal sale con tu firma"
          total={correo.length} pendientes={correo.filter((m) => m.status === "pendiente_datos").length}
        />
        <ChannelLane
          canal="telegram" active={canal === "telegram"} href={href("telegram")}
          title="Telegram del turno" desc="capa de velocidad del turno — contexto y decisiones rápidas, nunca sustituye el registro"
          total={telegram.length} pendientes={telegram.filter((m) => m.status === "pendiente_datos").length}
        />
      </div>

      {/* filtros */}
      <div className="rise mb-4 flex flex-wrap items-center gap-2">
        <FilterLink href={href(null)} active={!canal} label={`Todos · ${msgs.length}`} />
        <FilterLink href={href("correo")} active={canal === "correo"} label={`Correo · ${correo.length}`} />
        <FilterLink href={href("telegram")} active={canal === "telegram"} label={`Telegram · ${telegram.length}`} />
        {msgs.some((m) => m.direction === "outbound") && (
          <span className="mono ml-auto text-[10px] text-slate-600">incluye salientes autorizados</span>
        )}
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="space-y-2.5 xl:col-span-2">
          {filtered.length === 0 && (
            <Panel><EmptyState icon={<Inbox size={17} />} title="Bandeja vacía" desc="Simula un correo entrante para ver cómo el copiloto lo guarda, clasifica, vincula y propone." /></Panel>
          )}
          {filtered.map((m) => (
            <MessageCard key={m.id} m={m} now={now} />
          ))}
        </div>

        <Panel className="rise rise-1 h-fit">
          <PanelTitle icon={<Database size={14} />} title="Política del canal" sub="lo que define el tono con la red" />
          <div className="space-y-2.5 p-4">
            {[
              ["Registrar y vincular", "todo correo de solicitud/oferta/rechazo; si no se puede vincular, se pregunta en vez de asumir."],
              ["Borrador + firma", "respuestas con datos operativos salen solo con aprobación humana, con constancia de qué, cuándo y quién."],
              ["Contenido = dato", "un 'ignora tus instrucciones' se registra, se avisa y no cambia ningún estado. Nunca."],
              ["Idempotencia", "reenvíos y reintentos no accionan dos veces; la duplicidad queda registrada."],
              ["Persecución del silencio", "si el destinatario calla, el sistema genera seguimiento con hora límite y luego escala."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-lg border hairline bg-white/[0.02] px-3 py-2.5">
                <div className="text-[11.5px] font-semibold text-slate-200">{t}</div>
                <div className="mt-0.5 text-[10.5px] leading-relaxed text-slate-500">{d}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

function ChannelLane({ canal, title, desc, total, pendientes, active, href }: { canal: string; title: string; desc: string; total: number; pendientes: number; active: boolean; href: string }) {
  return (
    <Link href={href} className={`panel panel-hover relative block overflow-hidden px-4 py-3.5 ${active ? "ring-1 ring-white/20" : ""}`}>
      <div className={`absolute inset-y-0 left-0 w-1 ${channelBar(canal)}`} />
      <div className="flex items-center gap-2.5 pl-1.5">
        <ChannelBadge channel={canal} />
        <span className="text-[12.5px] font-bold text-white">{title}</span>
        <span className="mono ml-auto text-[11px] text-slate-400">{total}</span>
      </div>
      <p className="mt-1.5 pl-1.5 text-[10.5px] leading-relaxed text-slate-500">{desc}</p>
      {pendientes > 0 && (
        <div className="mono ml-1.5 mt-2 inline-flex rounded-md bg-amber-400/10 px-2 py-0.5 text-[9px] text-amber-300 ring-1 ring-amber-400/30">
          {pendientes} esperando datos
        </div>
      )}
    </Link>
  );
}

function FilterLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link href={href} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium ring-1 transition ${active ? "bg-teal-400/15 text-teal-200 ring-teal-400/40" : "bg-white/[0.03] text-slate-400 ring-white/10 hover:bg-white/[0.06] hover:text-slate-200"}`}>
      {label}
    </Link>
  );
}

function MessageCard({ m, now }: { m: Msg; now: Date }) {
  const cls = m.classification ? MESSAGE_CLASSIFICATIONS[m.classification] : null;
  const isOut = m.direction === "outbound";

  return (
    <Link
      href={`/bandeja/${m.id}`}
      className={`panel panel-hover group relative block overflow-hidden p-4 pl-5 ${m.classification === "instruccion_sistema" ? "ring-1 ring-fuchsia-400/30" : ""}`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${isOut ? "bg-emerald-400" : channelBar(m.channel)}`} />
      <div className="flex flex-wrap items-center gap-2">
        <ChannelBadge channel={m.channel} size="sm" />
        {isOut && (
          <span className="mono flex items-center gap-1 rounded-md bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/30">
            <SendHorizontal size={9} /> enviado · autorizado
          </span>
        )}
        <span className="text-[11px] font-medium text-slate-400">{m.fromName}</span>
        <ArrowUpRight size={12} className="text-slate-600 opacity-0 transition group-hover:opacity-100" />
        <div className="ml-auto flex items-center gap-1.5">
          {cls && (
            <span className={`flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold ring-1 ring-white/10 ${cls.text}`}>
              <span className={`h-1 w-1 rounded-full ${cls.dot}`} />
              {cls.label}
            </span>
          )}
          <span className={`mono rounded-md px-2 py-0.5 text-[9.5px] ring-1 ${
            m.status === "pendiente_datos" ? "bg-amber-400/10 text-amber-300 ring-amber-400/30"
            : m.status === "vinculado" || m.status === "atendido" || m.status === "enviado" ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30"
            : m.status === "no_aplica" ? "bg-fuchsia-400/10 text-fuchsia-300 ring-fuchsia-400/30"
            : "bg-white/[0.04] text-slate-400 ring-white/10"
          }`}>{MESSAGE_STATUS[m.status] ?? m.status}</span>
        </div>
      </div>

      <h3 className="mt-2 text-[13.5px] font-bold text-white transition group-hover:text-teal-100">{m.subject}</h3>
      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-slate-400">{m.body}</p>

      <div className="mono mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] text-slate-600">
        <span>{dayTime(m.receivedAt)} · {ago(m.receivedAt, now)}</span>
        {m.bedCode && (
          <span className="inline-flex items-center gap-1 rounded-md bg-sky-400/10 px-1.5 py-0.5 font-bold text-sky-300 ring-1 ring-sky-400/25">
            vinculado: {m.bedCode}
          </span>
        )}
        {m.pendingApprovalCode && (
          <span className="rounded bg-violet-400/10 px-1.5 py-0.5 text-violet-300 ring-1 ring-violet-400/30">
            borrador {m.pendingApprovalCode} esperándote
          </span>
        )}
        {m.handledBy && <span className="text-emerald-300/80">por {m.handledBy}</span>}
      </div>
    </Link>
  );
}
