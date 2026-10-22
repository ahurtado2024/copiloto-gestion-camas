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
  import { PageHeader, Panel, PanelTitle, Stat, BedStateBadge, EmptyState, EventDot, Bars } from "@/components/ui";
  import { ActionButton, ApproveRejectButtons, Refresher } from "@/components/client";
  import { BedLink, BedLabel, TaskLink } from "@/components/links";
  import { auth } from "@/auth";
  
  export const dynamic = "force-dynamic";
  
  function greeting(now: Date): string {
    const h = now.getHours();
    if (h >= 6 && h < 13) return "Buenos días";
    if (h >= 13 && h < 20) return "Buenas tardes";
    return "Buenas noches";
  }
  
  export default async function Tablero() {
    const now = new Date();
    const [session, rules, { beds, ests }, { active: activeTasks }, { pending: pendingApprovals }, { open: openConflicts }, { events: recent }, m] =
      await Promise.all([
        auth(),
        getRules(),
        loadBeds(now),
        loadTasks(now),
        loadApprovals(now),
        loadConflicts(now),
        loadEvents(now, 9),
        computeMetrics(now),
      ]);
  
    const userName = session?.user?.name ?? rules.TURNO_ACTOR;
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
      <div className="rise-up space-y-8">
        <Refresher seconds={25} />
        
        <PageHeader
          kicker={`${longDate(now)} · Centralizado`}
          title={`${greeting(now)}, ${userName.split(" ").pop()}`}
          desc={`Red O'Higgins: ${freshAvailable.length} camas listas · ${activeTasks.length} en ciclo · ${pendingApprovals.length} por autorizar.`}
          actions={
            <>
              <ActionButton op="capacity_query" label="Consultar Red" icon={<PhoneOff size={14} />} variant="sky" />
              <Link href="/bandeja" className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-[13px] font-bold text-white shadow-lg transition hover:bg-gray-800">
                <Radio size={15} /> Bandeja Central
              </Link>
            </>
          }
        />
  
        {/* ---------------- KPIs (Estilo Tarjetas Referencia) ---------------- */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Disponibles" value={String(freshAvailable.length)} tone="ok" icon={<BedDouble size={18} />}
            sub={staleAvailable.length > 0 ? `+${staleAvailable.length} vencidas` : "Dato fresco"} />
          <Stat label="M1 · Reacción" value={m.m1.avg !== null ? `${m.m1.avg}'` : "—"} tone={m.m1.avg !== null && m.m1.avg <= 10 ? "ok" : "warn"} icon={<Timer size={18} />}
            sub={m.m1.n ? `${m.m1.n} avisos hoy` : "Sin ciclos"} />
          <Stat label="M2 · Eficiencia" value={m.m2.avg !== null ? duration(m.m2.avg) : "—"} tone="violet" icon={<Activity size={18} />}
            sub={m.m2.n ? `${m.m2.n} liberadas` : "En proceso"} />
          <Stat label="Pendientes" value={String(pendingApprovals.length)} tone={pendingApprovals.length ? "violet" : "default"} icon={<ShieldCheck size={18} />}
            sub="Espera decisión" />
          <Stat label="Conflictos" value={String(openConflicts.length)} tone={openConflicts.length ? "danger" : "default"} icon={<AlertTriangle size={18} />}
            sub="Datos bloqueados" />
          <Stat label="Atrasos" value={String(m.m4.overdue)} tone={m.m4.overdue ? "danger" : "default"} icon={<Flame size={18} />}
            sub={`Fuera de SLA`} />
        </div>
  
        {/* ---------------- Cuerpo Principal (Grids con Sangría) ---------------- */}
        <div className="grid gap-6 xl:grid-cols-3">
          
          {/* Columna Izquierda: Actividad y Movimiento */}
          <div className="xl:col-span-2 space-y-6">
            <Panel>
              <PanelTitle icon={<Activity size={16} />} title="Capacidad Líquida de la Red" sub="Estado en tiempo real por establecimiento" />
              <div className="grid divide-y divide-gray-100 md:grid-cols-3 md:divide-y-0 md:divide-x">
                {perEst.map((e) => (
                  <div key={e.id} className="p-6 transition hover:bg-gray-50/50">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-[14px] font-black text-gray-900 leading-tight">{e.code}</div>
                        <div className="text-[11px] font-medium text-gray-500">{e.name}</div>
                      </div>
                      <ArrowUpRight size={14} className="text-gray-300" />
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[28px] font-black text-emerald-600">{e.disponibles}</span>
                      <span className="text-[11px] font-bold text-gray-400 uppercase">libres</span>
                    </div>
                    <div className="mt-4 flex h-2 gap-1 overflow-hidden rounded-full bg-gray-100">
                      <div className="bg-emerald-500 rounded-full" style={{ width: `${(e.disponibles / e.total) * 100}%` }} />
                      <div className="bg-sky-400 rounded-full" style={{ width: `${(e.ciclo / e.total) * 100}%` }} />
                      <div className="bg-gray-300 rounded-full" style={{ width: `${(e.ocupadas / e.total) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
  
            <Panel>
              <PanelTitle icon={<Activity size={16} />} title="Operaciones en Curso" sub="Camas con acción pendiente" 
                right={<span className="pill bg-gray-100 text-gray-600">{moving.length} activas</span>} />
              <div className="divide-y divide-gray-50">
                {moving.slice(0, 8).map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-6 py-4 transition hover:bg-gray-50/30">
                    <div className="flex items-center gap-6">
                      <div className="min-w-[100px]">
                        <BedLink code={b.code} className="text-[15px]" />
                        <div className="text-[11px] font-bold text-gray-400 mt-0.5">{b.unit}</div>
                      </div>
                      <BedStateBadge status={b.effectiveStatus} size="sm" />
                      <div className="hidden mono text-[12px] font-bold text-gray-500 md:block">
                        {duration(b.minutesInStatus)} <span className="text-[10px] font-medium text-gray-300 ml-1">en estado</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {b.activeTaskCode && <TaskLink code={b.activeTaskCode} />}
                      <Link href={`/camas/${b.code}`} className="p-2 text-gray-300 hover:text-emerald-600 transition">
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
  
          {/* Columna Derecha: Alertas y Control */}
          <div className="space-y-6">
            <Panel className="border-violet-200 bg-violet-50/10">
              <PanelTitle icon={<ShieldCheck size={16} className="text-violet-600" />} title="Por Autorizar" sub="Tu firma es necesaria" />
              <div className="p-4 space-y-4">
                {pendingApprovals.length === 0 ? (
                  <EmptyState icon={<ShieldCheck size={20} />} title="Todo al día" desc="No hay propuestas esperando." />
                ) : (
                  pendingApprovals.slice(0, 3).map((a) => (
                    <div key={a.id} className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <BedLabel code={a.bedCode || "SYS"} className="text-[14px]" />
                        <span className="mono text-[10px] font-black text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">vence en {Math.round((a.expiresAt.getTime() - now.getTime()) / 60000)}'</span>
                      </div>
                      <div className="text-[13px] font-bold text-gray-900 leading-snug">{a.title}</div>
                      <div className="mt-4">
                        <ApproveRejectButtons approvalId={a.id} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>
  
            <Panel>
              <PanelTitle icon={<ScrollText size={16} />} title="Caja Negra" sub="Últimos movimientos registrados" 
                right={<Link href="/registro" className="text-[11px] font-bold text-emerald-600">Ver todo</Link>} />
              <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-50">
                {recent.map((e) => (
                  <div key={e.id} className="flex gap-4 p-4 hover:bg-gray-50/50 transition">
                    <EventDot kind={e.kind} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold text-gray-800 leading-snug">{e.summary}</div>
                      <div className="mt-1 flex items-center gap-2 mono text-[10px] font-bold text-gray-400">
                        <span>{ago(e.ts, now)}</span>
                        <span className="h-1 w-1 rounded-full bg-gray-200" />
                        <span className="uppercase">{e.actor}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    );
  }
  
  function labelDe(v: string): string {
    return (BED_STATE_META[v as keyof typeof BED_STATE_META]?.short ?? v).toLowerCase();
  }
  