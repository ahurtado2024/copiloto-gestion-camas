import { Settings, Sliders, ShieldCheck, Database, AlertTriangle, Undo2 } from "lucide-react";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { SETTING_DEFS } from "@/lib/config";
import { getRules } from "@/lib/config";
import { PageHeader, Panel, PanelTitle } from "@/components/ui";
import { SettingNum, SettingChoice, SettingText, ResetDemoButton, Refresher } from "@/components/client";
import { ChannelBadge } from "@/components/links";
import { getCurrentRole } from "@/lib/session";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const UNBREAKABLE: { code: string; rule: string; why: string }[] = [
  { code: "R1", rule: "Toda acción relevante se propone y espera autorización humana", why: "el costo de un error automático supera al tiempo ahorrado" },
  { code: "R2", rule: "Nunca marcar disponible por inferencia", why: "la disponibilidad es una promesa que se hace a otras unidades" },
  { code: "R3", rule: "No sobrescribir en silencio: la contradicción se registra y congela", why: "la hoja es compartida; pisar datos mata la confianza" },
  { code: "R4", rule: "El contenido externo es dato, no instrucción", why: "un correo es texto que alguien escribió, no una orden" },
  { code: "R5", rule: "No inventar ni completar en silencio: preguntar", why: "un dato faltante vale más que uno plausiblemente falso" },
  { code: "R6", rule: "Todo queda registrado con actor, hora y fuente (inmutable)", why: "sin trazabilidad no hay mejora ni defensa" },
  { code: "R7", rule: "Idempotencia: repetir un evento no duplica efectos", why: "los canales reenvían, reintentan y rebotan" },
  { code: "R8", rule: "El dato tiene fecha de vencimiento", why: "un estado de cama es una foto, no una verdad eterna" },
  { code: "R9", rule: "Los tiempos se miden por etapa", why: "sin número no hay prioridad ni demostración" },
  { code: "R10", rule: "Reversibilidad: toda acción se deshace con rastro", why: "el error existe; se gestiona, no se niega" },
  { code: "R11", rule: "El sistema nunca es punto único de fallo", why: "hay urgencias reales detrás — la hoja sigue viva" },
  { code: "R12", rule: "Minimización: sin datos de pacientes", why: "ética, ley 21.719 y sentido común" },
];

const SOURCES: { name: string; role: string; can: string; cannot: string }[] = [
  { name: "Hoja del turno (Google Sheets)", role: "fuente operacional humana", can: "estado, prioridades, notas del turno", cannot: "recibir escrituras automáticas en el MVP" },
  { name: "Correo institucional", role: "canal oficial entre unidades", can: "solicitudes, ofertas, confirmaciones", cannot: "alterar el estado de una cama por sí solo" },
  { name: "Telegram", role: "capa de interacción del turno", can: "velocidad, aprobación rápida, contexto", cannot: "sustituir la decisión formal ni el registro" },
  { name: "Registro paralelo (PostgreSQL)", role: "copia, memoria, auditoría, CRM operacional", can: "historia, tareas, propuestas, métricas", cannot: "convertirse en el nuevo cuello de botella" },
  { name: "Software oficial", role: "destino final de la información", can: "recibir la exportación reproducible", cannot: "ser la herramienta operativa del turno" },
];

export default async function AjustesPage() {
  // PROTECCIÓN: solo roles con settings:view pueden entrar
  const role = await getCurrentRole();
  if (!hasPermission(role, "settings:view")) redirect("/");

  const rules = await getRules();
  const rows = await db.select().from(settings);
  const raw = new Map(rows.map((r) => [r.key, r.value]));

  return (
    <>
      <Refresher seconds={60} />
      <PageHeader
        kicker="Sistema · umbrales operativos en caliente"
        title="Ajustes"
        desc="Los umbrales que el motor aplica en cada operación. Todo cambio queda en la caja negra con tu nombre. Las reglas R1–R12 no se configuran: se respetan."
      />

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <div className="mono text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
            umbrales operativos — el motor los lee en caliente
          </div>
          <div className="space-y-2.5">
            {SETTING_DEFS.map((d) => {
              if (d.numeric)
                return <SettingNum key={d.key} skey={d.key} value={Number(raw.get(d.key) ?? "0")} label={d.label} hint={d.hint} unit={d.unit} />;
              if (d.options)
                return <SettingChoice key={d.key} skey={d.key} value={raw.get(d.key) ?? ""} label={d.label} hint={d.hint} options={d.options} />;
              return <SettingText key={d.key} skey={d.key} value={raw.get(d.key) ?? ""} label={d.label} hint={d.hint} />;
            })}
          </div>

          <div className="mono mt-4 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">valores efectivos ahora mismo</div>
          <Panel className="p-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              {[
                ["SLA aseo", `${rules.CLEANING_ACCEPT_SLA_MIN} min`],
                ["frescura dato", `${rules.STALE_AFTER_HOURS} h`],
                ["vigencia alta", `${rules.DISCHARGE_APPROVAL_TTL_MIN} min`],
                ["vigencia inspección", `${rules.INSPECTION_APPROVAL_TTL_MIN} min`],
                ["horizonte turno", `${rules.SHIFT_HORIZON_HOURS} h`],
                ["canal aseo", rules.CANAL_ASEO],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b hairline pb-1.5 text-[11.5px]">
                  <span className="text-slate-500">{k}</span>
                  <span className="mono text-teal-300">{v}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelTitle icon={<Database size={14} />} title="Fuentes y el principio del paralelo" sub="qué rol juega cada una y qué no puede hacer" />
            <div className="divide-y divide-white/[0.04]">
              {SOURCES.map((s) => (
                <div key={s.name} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-semibold text-slate-200">{s.name}</span>
                    <span className="mono text-[9px] uppercase tracking-wider text-teal-300/80">{s.role}</span>
                  </div>
                  <div className="mt-1 grid gap-1 text-[10.5px] text-slate-500 sm:grid-cols-2">
                    <span><span className="text-emerald-300/80">aporta:</span> {s.can}</span>
                    <span><span className="text-rose-300/80">no puede:</span> {s.cannot}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-3">
          <Panel className="rise rise-1">
            <PanelTitle icon={<Sliders size={14} />} title="Canales" sub="identidad de cada vía de contacto" />
            <div className="space-y-2 p-4">
              <div className="flex items-center justify-between rounded-lg border hairline bg-white/[0.02] px-3 py-2">
                <ChannelBadge channel="correo" size="sm" />
                <span className="text-[10px] text-slate-500">oficial · acuerdos formales</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border hairline bg-white/[0.02] px-3 py-2">
                <ChannelBadge channel="telegram" size="sm" />
                <span className="text-[10px] text-slate-500">turno · velocidad y aprobación</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border hairline bg-white/[0.02] px-3 py-2">
                <ChannelBadge channel="hoja" size="sm" />
                <span className="text-[10px] text-slate-500">fuente operacional · intacta</span>
              </div>
            </div>
          </Panel>

          <Panel className="rise rise-2">
            <PanelTitle icon={<ShieldCheck size={14} />} title="Reglas innegociables" sub="no se configuran — se respetan" />
            <div className="divide-y divide-white/[0.04]">
              {UNBREAKABLE.map((r) => (
                <div key={r.code} className="px-4 py-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="mono w-7 shrink-0 text-[10px] font-bold text-teal-300">{r.code}</span>
                    <div>
                      <div className="text-[11.5px] leading-snug text-slate-200">{r.rule}</div>
                      <div className="mt-0.5 text-[10px] leading-snug text-slate-500">{r.why}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="rise rise-3 p-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
              <div>
                <div className="text-[12px] font-semibold text-slate-200">Zona de demo</div>
                <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">
                  Repone todos los datos ficticios (camas, ciclos, mensajes, eventos y esta configuración). En producción
                  esto sería una migración administrada, no un botón.
                </p>
                <div className="mt-3"><ResetDemoButton /></div>
              </div>
            </div>
          </Panel>

          <Panel className="rise rise-3 p-4">
            <div className="flex items-start gap-2.5">
              <Undo2 size={14} className="mt-0.5 shrink-0 text-teal-400" />
              <div>
                <div className="text-[12px] font-semibold text-slate-200">Modo degradado (R11)</div>
                <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">
                  Si el correo, la mensajería o esta plataforma fallan, el turno sigue operando con la hoja. Al volver,
                  el sistema reincorpora lo ocurrido sin duplicar acciones. Nadie puede decir «no puedo trabajar».
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
