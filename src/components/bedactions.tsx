import { Eye, Ban, RotateCcw, CheckCheck, ShieldAlert } from "lucide-react";
import type { BedView } from "@/lib/queries";
import { ago } from "@/lib/time";
import { ActionButton } from "@/components/client";

export default function BedActions({ b, now, size = "sm" }: { b: BedView; now: Date; size?: "sm" | "md" }) {
  const inPipeline = ["pending_cleaning", "cleaning", "cleaning_completed", "pending_inspection"].includes(b.status);
  return (
    <div className="flex flex-wrap gap-1.5">
      {b.status === "occupied" && b.openConflictId === null && (
        <ActionButton op="bed" params={{ bedId: b.id, bedOp: "propose_discharge" }} label="Detecté alta" size={size} variant="violet" icon={<Eye size={11} />}
          confirmText={`Se propondrá el alta de ${b.code}. Tú confirmas y recién ahí sale el aviso a aseo (R1).`} />
      )}
      {b.status === "unknown" && (
        <ActionButton op="bed" params={{ bedId: b.id, bedOp: "propose_discharge" }} label="Detecté alta" size={size} variant="violet" icon={<Eye size={11} />}
          confirmText={`Se propondrá el alta de ${b.code} (estaba en "desconocido").`} />
      )}
      {b.stale && (
        <ActionButton op="bed" params={{ bedId: b.id, bedOp: "reconfirm" }} label="Verifiqué en terreno" size={size} variant="warn" icon={<CheckCheck size={11} />}
          confirmText={`Solo confirma si realmente verificaste ${b.code}.`} />
      )}
      {b.status === "occupied" && !b.openConflictId && (
        <ActionButton op="bed" params={{ bedId: b.id, bedOp: "out_of_service", reason: "mantención" }} label="Fuera de servicio" size={size} variant="ghost"
          confirmText={`¿Dar de baja ${b.code}?`} />
      )}
      {b.status === "available" && !b.stale && !b.openConflictId && (
        <>
          <ActionButton op="bed" params={{ bedId: b.id, bedOp: "reserve", reason: "solicitud de la red" }} label="Reservar" size={size} variant="primary"
            confirmText={`¿Reservar ${b.code}? Dato confirmado ${ago(b.lastConfirmedAt, now)}.`} />
          <ActionButton op="bed" params={{ bedId: b.id, bedOp: "block", reason: "bloqueo operativo" }} label="Bloquear" size={size} variant="danger" icon={<Ban size={11} />}
            confirmText={`¿Bloquear ${b.code}?`} />
        </>
      )}
      {b.status === "reserved" && (
        <ActionButton op="bed" params={{ bedId: b.id, bedOp: "release", reason: "solicitud retirada" }} label="Liberar reserva" size={size} variant="ghost" icon={<RotateCcw size={11} />}
          confirmText={`¿Liberar la reserva de ${b.code}?`} />
      )}
      {(b.status === "blocked" || b.status === "out_of_service") && (
        <ActionButton op="bed" params={{ bedId: b.id, bedOp: "reincorporate" }} label="Reincorporar" size={size} variant="ghost" icon={<RotateCcw size={11} />}
          confirmText={`${b.code} volverá como "DESCONOCIDO" (R5).`} />
      )}
      {inPipeline && (
        <ActionButton op="bed" params={{ bedId: b.id, bedOp: "mark_available" }} label="Disponible directo" size={size} variant="danger" icon={<ShieldAlert size={11} />}
          confirmText={`PRUEBA R2: el sistema debe negarse.`} />
      )}
    </div>
  );
}
