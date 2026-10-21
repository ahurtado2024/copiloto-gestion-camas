/* ------------------------------------------------------------------ */
/*  POST /api/mail/sync                                                */
/*  Conecta al inbox real y procesa los correos entrantes.             */
/*  Usa externalId para idempotencia (R7): no duplica correos.         */
/* ------------------------------------------------------------------ */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { messages, beds } from "@/db/schema";
import { fetchInbox } from "@/lib/mail";
import { proposeDischarge, logEvent } from "@/lib/engine";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function extractBedCode(text: string, bedCodes: string[]): string | null {
  const normalized = text.toUpperCase();
  return bedCodes.find(code => normalized.includes(code)) || null;
}

export async function POST() {
  try {
    const mailResult = await fetchInbox();

    if (!mailResult.ok) {
      return NextResponse.json({ ok: false, message: mailResult.error, tone: "error" });
    }

    if (mailResult.emails.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No se encontraron correos en la ventana de tiempo configurada.",
        tone: "ok",
      });
    }

    const allBeds = await db.select({ id: beds.id, code: beds.code, unit: beds.unit }).from(beds);
    const bedCodes = allBeds.map(b => b.code.toUpperCase());

    let newCount = 0;
    let skippedCount = 0;
    let proposalCount = 0;

    for (const email of mailResult.emails) {
      // R7 — Idempotencia: si ya existe este correo, se salta
      const existing = await db.select({ id: messages.id })
        .from(messages)
        .where(eq(messages.externalId, email.externalId))
        .limit(1);

      if (existing.length > 0) {
        skippedCount++;
        continue;
      }

      const detectedCode = extractBedCode(email.subject + " " + email.body, bedCodes);
      const bed = allBeds.find(b => b.code.toUpperCase() === detectedCode);

      const isAlta = email.subject.toLowerCase().includes("alta")
        || email.subject.toLowerCase().includes("egreso")
        || email.subject.toLowerCase().includes("libre");

      const [msg] = await db.insert(messages).values({
        externalId: email.externalId,
        channel: "correo",
        direction: "inbound",
        fromName: email.fromName,
        fromAddress: email.fromAddress,
        smtpMessageId: email.smtpMessageId,
        subject: email.subject,
        body: email.body.substring(0, 5000), // Limitar tamaño del body
        receivedAt: email.receivedAt,
        status: bed ? "vinculado" : "nuevo",
        bedId: bed?.id || null,
        classification: isAlta ? "alta" : "administrativo",
      }).returning();

      newCount++;

      // Si detectamos un alta y hay cama, crear PROPUESTA (R1)
      if (bed && isAlta) {
        proposalCount++;
        await proposeDischarge({
          bedId: bed.id,
          origin: "correo",
          messageId: msg.id,
          evidence: `Detectado desde correo real de ${email.fromName}: "${email.subject}"`,
        });
      }

      await logEvent({
        actor: "sistema",
        source: "correo",
        kind: "correo_recibido",
        summary: `Correo real: "${email.subject}" de ${email.fromName}${bed ? ` → vinculado a ${bed.code}` : ""}.`,
        bedId: bed?.id ?? null,
        payload: { messageId: msg.id, bedCode: bed?.code ?? null },
      });
    }

    const parts: string[] = [];
    parts.push(`${mailResult.emails.length} correos encontrados en el servidor`);
    if (newCount > 0) parts.push(`${newCount} nuevos procesados`);
    if (skippedCount > 0) parts.push(`${skippedCount} ya existían (idempotencia R7)`);
    if (proposalCount > 0) parts.push(`${proposalCount} propuestas de alta generadas`);

    return NextResponse.json({
      ok: true,
      message: `Sync completado: ${parts.join(", ")}.`,
      tone: newCount > 0 ? "ok" : "warn",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ ok: false, message: `Error en sync: ${msg}`, tone: "error" });
  }
}
