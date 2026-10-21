import { Users, Star, Building2, Mail, Clock3 } from "lucide-react";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { desc } from "drizzle-orm";
import { PageHeader, Panel, PanelTitle, EmptyState } from "@/components/ui";
import { ago } from "@/lib/time";
import { ActionButton } from "@/components/client";
import { getCurrentRole } from "@/lib/session";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const role = await getCurrentRole();
  if (!hasPermission(role, "agenda:view")) redirect("/");

  const allContacts = await db.select().from(contacts).orderBy(desc(contacts.isPriority), desc(contacts.lastInteractionAt));

  return (
    <>
      <PageHeader
        kicker="Memoria de Red · Contactos frecuentes"
        title="Agenda de Establecimientos"
        desc="Memoriza y destaca los correos de otros hospitales y centros. El copiloto los usará para priorizar alertas y sugerir respuestas rápidas."
      />

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-3">
          {allContacts.length === 0 ? (
            <Panel>
              <EmptyState 
                icon={<Users size={17} />} 
                title="Agenda vacía" 
                desc="El sistema memorizará automáticamente los correos con los que interactúes. También puedes marcarlos como prioritarios aquí." 
              />
            </Panel>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {allContacts.map((c) => (
                <Panel key={c.id} className={`p-4 ${c.isPriority ? 'border-amber-200 bg-amber-50/20' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${c.isPriority ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                        {c.name[0]}
                      </div>
                      <div>
                        <div className="text-[13px] font-bold text-slate-900">{c.name}</div>
                        <div className="text-[11px] text-slate-500">{c.organization || 'Sin organización'}</div>
                      </div>
                    </div>
                    {c.isPriority === 1 && <Star size={14} className="fill-amber-400 text-amber-400" />}
                  </div>
                  
                  <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-[11.5px] text-slate-600">
                    <div className="flex items-center gap-2"><Mail size={12} className="text-slate-400" /> {c.email}</div>
                    <div className="flex items-center gap-2"><Clock3 size={12} className="text-slate-400" /> Última interacción: {ago(c.lastInteractionAt, new Date())}</div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <ActionButton 
                      op="save_contact" 
                      params={{ id: c.id, priority: c.isPriority === 1 ? 0 : 1 }} 
                      label={c.isPriority === 1 ? "Quitar prioridad" : "Marcar prioritario"} 
                      size="sm" 
                      variant={c.isPriority === 1 ? "ghost" : "warn"} 
                    />
                  </div>
                </Panel>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Panel className="p-4">
            <PanelTitle icon={<Star size={14} />} title="Importancia del Portafolio" />
            <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
              Cuando marcas un contacto como <b>Prioritario</b>:
              <br/><br/>
              1. El Agente de Telegram te avisará si tienen un correo sin responder.
              <br/>
              2. Los correos entrantes de este remitente aparecerán destacados en la Bandeja.
              <br/>
              3. El sistema sugerirá redactar borradores proactivamente al recibir sus solicitudes.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
