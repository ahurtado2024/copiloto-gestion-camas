/* ------------------------------------------------------------------ */
/*  POST /api/mail/sync                                                */
/*  Lee el inbox y persiste los correos con threading bidireccional.   */
/* ------------------------------------------------------------------ */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { messages, beds, settings } from "@/db/schema";
import { fetchInbox } from "@/lib/mail";
import { proposeDischarge, logEvent } from "@/lib/engine";
import { resolveThread, normalizeSubject } from "@/lib/email-threading";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function extractBedCode(text: string, bedCodes: string[]): string | null {
  const normalized = text.toUpperCase();
  return bedCodes.find((code) => normalized.includes(code)) || null;
}

export async function POST() {
  try {
    // 1. Obtener el último UID sincronizado desde settings
    const [lastUidRow] = await db.select().from(settings).where(eq(settings.key, "mail_last_synced_uid"));
    const lastUid = lastUidRow ? parseInt(lastUidRow.value, 10) : undefined;

    // 2. Ejecutar fetch (incremental si existe lastUid)
    const mailResult = await fetchInbox(lastUid);

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
    const bedCodes = allBeds.map((b) => b.code.toUpperCase());

    let newCount = 0;
    let maxUidInSync = lastUid || 0;
    let skippedCount = 0;
    let proposalCount = 0;

    for (const email of mailResult.emails) {
      // R7 — Idempotencia
      const existing = await db
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.externalId, email.externalId))
        .limit(1);

      if (existing.length > 0) {
        skippedCount++;
        continue;
      }

      // Detectar cama en asunto + cuerpo
      const detectedCode = extractBedCode(email.subject + " " + email.body, bedCodes);
      const bed = allBeds.find((b) => b.code.toUpperCase() === detectedCode);

      const subjectLower = email.subject.toLowerCase();
      const isAlta =
        subjectLower.includes("alta") ||
        subjectLower.includes("egreso") ||
        subjectLower.includes("libre");

      // Resolver el hilo con las 3 capas (headers → asunto+remitente → nuevo)
      const thread = await resolveThread({
        fromAddress: email.fromAddress,
        subject: email.subject,
        smtpMessageId: email.smtpMessageId,
        smtpInReplyTo: email.smtpInReplyTo,
        smtpReferences: email.smtpReferences,
      });

      const [msg] = await db
        .insert(messages)
        .values({
          externalId: email.externalId,
          channel: "correo",
          direction: "inbound",
          fromName: email.fromName,
          fromAddress: email.fromAddress,
          smtpMessageId: email.smtpMessageId || null,
          smtpInReplyTo: email.smtpInReplyTo || null,
          smtpReferences: email.smtpReferences || null,
          subjectKey: thread.subjectKey,
          threadKey: thread.threadKey,
          subject: email.subject,
          body: email.body.substring(0, 5000),
          receivedAt: email.receivedAt,
          status: bed ? "vinculado" : "nuevo",
          bedId: bed?.id ?? null,
          inReplyTo: thread.parentMessageId,
          classification: isAlta ? "alta" : "administrativo",
        })
        .returning();

      newCount++;

      // Si detectamos un alta y hay cama → PROPUESTA (R1)
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
        summary: `Correo real: "${email.subject}" de ${email.fromName}${bed ? ` → vinculado a ${bed.code}` : ""}${thread.parentMessageId ? " → hilo detectado" : ""}.`,
        bedId: bed?.id ?? null,
        payload: {
          messageId: msg.id,
          bedCode: bed?.code ?? null,
          threadKey: thread.threadKey,
          parentMessageId: thread.parentMessageId,
        },
      });
    }

    const parts: string[] = [];
    parts.push(`${mailResult.emails.length} correos en el servidor`);
    if (newCount > 0) parts.push(`${newCount} nuevos`);
    if (skippedCount > 0) parts.push(`${skippedCount} ya existían (R7)`);
    if (proposalCount > 0) parts.push(`${proposalCount} propuestas de alta`);

    // 3. Actualizar el marcador de progreso en settings
    if (maxUidInSync > (lastUid || 0)) {
      await db.insert(settings).values({
        key: "mail_last_synced_uid",
        value: maxUidInSync.toString()
      }).onConflictDoUpdate({
        target: settings.key,
        set: { value: maxUidInSync.toString() }
      });
    }

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


