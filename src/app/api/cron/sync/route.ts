/* ------------------------------------------------------------------ */
/*  GET /api/cron/sync                                                 */
/*  Cron Job diario — sincroniza correo + hoja + notifica Telegram     */
/*  Vercel Hobby: 1 vez/día (0 8 * * * = 8:00 AM UTC)                 */
/*  Protegido por CRON_SECRET para que solo Vercel pueda invocarlo.    */
/* ------------------------------------------------------------------ */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { messages, settings, beds } from "@/db/schema";
import { fetchInbox } from "@/lib/mail";
import { resolveThread } from "@/lib/email-threading";
import { proposeDischarge } from "@/lib/engine";
import { sendMessage } from "@/lib/telegram";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function buildTelegramCard(card: {
  id: number;
  fromName: string;
  subject: string;
  preview: string;
  bedCode: string | null;
  isAlta: boolean;
  isThread: boolean;
  receivedAt: Date;
}, appUrl: string): string {
  const alertIcon = card.isAlta ? "🚨" : (card.bedCode ? "🛏" : "📬");
  const threadIcon = card.isThread ? "🔗" : "✉️";
  const mins = Math.round((Date.now() - card.receivedAt.getTime()) / 60000);
  const ago = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h`;

  let text = `${alertIcon} ${threadIcon} <b>${card.subject}</b>\n`;
  text += `👤 <i>${card.fromName}</i> · hace ${ago}\n`;
  if (card.bedCode) text += `🏥 Cama: <b>${card.bedCode}</b>\n`;
  if (card.isAlta) text += `⚠️ <b>AVISO DE ALTA DETECTADO</b>\n`;
  if (card.isThread) text += `🔗 <i>Respuesta en hilo existente</i>\n`;
  text += `\n<blockquote>${card.preview}…</blockquote>`;
  text += `\n\n<a href="${appUrl}/bandeja/${card.id}">Ver en Copiloto</a> | /descartar_${card.id}`;

  return text;
}

export async function GET(request: Request) {
  // Verificar que la llamada viene de Vercel Cron
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const chatTurno = process.env.TELEGRAM_CHAT_ID_TURNO;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const results: Record<string, unknown> = {};

  // ─── 1. SINCRONIZAR CORREO ─────────────────────────────────────────
  try {
    const [lastUidRow] = await db.select().from(settings).where(eq(settings.key, "mail_last_synced_uid"));
    const lastUid = lastUidRow ? parseInt(lastUidRow.value, 10) : undefined;

    const mailResult = await fetchInbox(lastUid);

    if (mailResult.ok && mailResult.emails.length > 0) {
      const allBeds = await db.select({ id: beds.id, code: beds.code, unit: beds.unit }).from(beds);
      const bedCodes = allBeds.map(b => b.code.toUpperCase());
      const newCards: Parameters<typeof buildTelegramCard>[0][] = [];
      let maxUid = lastUid || 0;

      for (const email of mailResult.emails) {
        const uid = parseInt(email.externalId, 10);
        if (uid > maxUid) maxUid = uid;

        const existing = await db.select().from(messages).where(eq(messages.externalId, email.externalId)).limit(1);
        if (existing.length > 0) continue;

        const thread = await resolveThread({
          fromAddress: email.fromAddress,
          subject: email.subject,
          smtpMessageId: email.smtpMessageId,
          smtpInReplyTo: email.smtpInReplyTo,
          smtpReferences: email.smtpReferences,
        });

        const bedCode = bedCodes.find(c => (email.subject + " " + email.body).toUpperCase().includes(c)) ?? null;
        const bed = bedCode ? allBeds.find(b => b.code.toUpperCase() === bedCode) : undefined;
        const isAlta = /alta|egreso|libre/i.test(email.subject);

        const [msg] = await db.insert(messages).values({
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
        }).returning();

        if (bed && isAlta) {
          await proposeDischarge({ bedId: bed.id, origin: "correo", messageId: msg.id });
        }

        newCards.push({
          id: msg.id,
          fromName: email.fromName,
          subject: email.subject,
          preview: email.body.substring(0, 100).replace(/\n/g, " ").trim(),
          bedCode: bed?.code ?? null,
          isAlta,
          isThread: !!thread.parentMessageId,
          receivedAt: email.receivedAt,
        });
      }

      if (maxUid > (lastUid || 0)) {
        await db.insert(settings).values({ key: "mail_last_synced_uid", value: maxUid.toString() })
          .onConflictDoUpdate({ target: settings.key, set: { value: maxUid.toString() } });
      }

      // Notificar por Telegram cada correo nuevo como tarjeta
      if (chatTurno && newCards.length > 0) {
        await sendMessage(chatTurno, `📬 <b>Sync diario: ${newCards.length} correo(s) nuevo(s)</b>`);
        for (const card of newCards) {
          await sendMessage(chatTurno, buildTelegramCard(card, appUrl), {
            reply_markup: {
              inline_keyboard: [[
                { text: "📂 Ver", url: `${appUrl}/bandeja/${card.id}` },
                { text: "🗑 Descartar", callback_data: `discard_${card.id}` },
              ]]
            }
          });
          await new Promise(r => setTimeout(r, 400));
        }
      }

      results.mail = { newEmails: newCards.length };
    } else {
      results.mail = { newEmails: 0, message: mailResult.ok ? "Sin correos nuevos" : mailResult.error };
    }
  } catch (e) {
    results.mail = { error: e instanceof Error ? e.message : "fallo" };
  }

  // ─── 2. SINCRONIZAR HOJA ───────────────────────────────────────────
  try {
    const sheetSync = await fetch(new URL("/api/sheets/sync", appUrl), { method: "POST" });
    const sheetResult = await sheetSync.json() as { ok: boolean; data?: { conflictsOpened?: number }; message?: string };
    results.sheets = sheetResult;

    if (chatTurno && sheetResult.ok && (sheetResult.data?.conflictsOpened ?? 0) > 0) {
      await sendMessage(chatTurno,
        `📊 <b>Sync hoja:</b> ${sheetResult.data?.conflictsOpened} diferencias detectadas entre la hoja del turno y el registro. Entra a <a href="${appUrl}/conflictos">Conflictos</a> para resolverlos.`
      );
    }
  } catch (e) {
    results.sheets = { error: e instanceof Error ? e.message : "fallo" };
  }

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), results });
}
