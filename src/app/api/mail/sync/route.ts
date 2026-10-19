/* ------------------------------------------------------------------ */
/*  POST /api/mail/sync                                                */
/*  Conecta al inbox real y procesa los correos entrantes.             */
/* ------------------------------------------------------------------ */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { messages, beds } from "@/db/schema";
import { fetchInbox } from "@/lib/mail";
import { proposeDischarge, logEvent } from "@/lib/engine";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Lógica de clasificación simple (MVP)
 * Busca códigos de cama en el asunto o cuerpo
 */
function extractBedCode(text: string, bedCodes: string[]): string | null {
  const normalized = text.toUpperCase();
  // Buscamos coincidencia exacta de los códigos que tenemos en DB
  return bedCodes.find(code => normalized.includes(code)) || null;
}

export async function POST() {
  const now = new Date();

  try {
    // 1. Obtener correos no leídos del servidor real
    const mailResult = await fetchInbox();
    
    if (!mailResult.ok) {
      return NextResponse.json({ ok: false, message: mailResult.error, tone: "error" });
    }

    if (mailResult.emails.length === 0) {
      return NextResponse.json({ ok: true, message: "No hay correos nuevos por procesar.", tone: "ok" });
    }

    // 2. Obtener lista de códigos de camas para vinculación
    const allBeds = await db.select({ id: beds.id, code: beds.code, unit: beds.unit }).from(beds);
    const bedCodes = allBeds.map(b => b.code.toUpperCase());

    let processedCount = 0;
    let vinculadosCount = 0;

    // 3. Procesar cada correo
    for (const email of mailResult.emails) {
      // Evitar duplicados por UID (R7)
      const existing = await db.select().from(messages).where(eq(messages.externalId, email.externalId));
      if (existing.length > 0) continue;

      const detectedCode = extractBedCode(email.subject + " " + email.body, bedCodes);
      const bed = allBeds.find(b => b.code.toUpperCase() === detectedCode);

      // Guardar mensaje en base de datos
      const [msg] = await db.insert(messages).values({
        externalId: email.externalId,
        channel: "correo",
        direction: "inbound",
        fromName: email.fromName,
        subject: email.subject,
        body: email.body,
        receivedAt: email.receivedAt,
        status: bed ? "vinculado" : "nuevo",
        bedId: bed?.id || null,
        classification: email.subject.toLowerCase().includes("alta") ? "alta" : "administrativo"
      }).returning();

      processedCount++;

      // 4. Si detectamos un alta y hay cama, crear PROPUESTA (R1)
      if (bed && msg.classification === "alta") {
        vinculadosCount++;
        await proposeDischarge({
          bedId: bed.id,
          origin: "correo",
          messageId: msg.id,
          evidence: `Detectado automáticamente desde correo real de ${email.fromName}: "${email.subject}"`
        });
      }

      await logEvent({
        actor: "sistema",
        source: "correo",
        kind: "correo_recibido",
        summary: `Correo real procesado: "${email.subject}" de ${email.fromName}.`,
        payload: { messageId: msg.id, bedCode: bed?.code }
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Sync de correo exitoso: ${processedCount} mensajes nuevos, ${vinculadosCount} propuestas de alta generadas.`,
      tone: "ok"
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ ok: false, message: `Error en sync de correo: ${msg}`, tone: "error" });
  }
}
