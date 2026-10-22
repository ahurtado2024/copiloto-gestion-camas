/* ------------------------------------------------------------------ */
/*  AGENTE EJECUTIVO — Copiloto de Gestión de Camas                    */
/*                                                                     */
/*  Arquitectura: Router determinista + fallback LLM                  */
/*  - Sin function-calling de OpenAI (evita errores de tipado)         */
/*  - Sincronización directa (sin auto-fetch que puede fallar)         */
/*  - Tarjetas de correo en Telegram con threading                     */
/*  - Descarte de correos irrelevantes                                 */
/* ------------------------------------------------------------------ */

import OpenAI from "openai";
import { sendMessage } from "./telegram";
import { getUnansweredEmails, getPriorityAlerts } from "./executive";
import { getSystemContextForAI } from "./queries";
import { db } from "@/db";
import { messages, settings, beds } from "@/db/schema";
import { eq, desc, and, lte } from "drizzle-orm";
import { resolveThread } from "./email-threading";
import { fetchInbox } from "./mail";
import { proposeDischarge } from "./engine";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ------------------------------------------------------------------ */
/*  SINCRONIZACIÓN DIRECTA                                             */
/*  Llama la lógica directamente en vez de HTTP fetch (más robusto)   */
/* ------------------------------------------------------------------ */

async function runMailSync(): Promise<{ ok: boolean; newEmails: NewEmailCard[]; message: string }> {
  try {
    const [lastUidRow] = await db.select().from(settings).where(eq(settings.key, "mail_last_synced_uid"));
    const lastUid = lastUidRow ? parseInt(lastUidRow.value, 10) : undefined;

    const mailResult = await fetchInbox(lastUid);
    if (!mailResult.ok) return { ok: false, newEmails: [], message: mailResult.error || "Error IMAP" };
    if (mailResult.emails.length === 0) return { ok: true, newEmails: [], message: "" };

    const allBeds = await db.select({ id: beds.id, code: beds.code, unit: beds.unit }).from(beds);
    const bedCodes = allBeds.map(b => b.code.toUpperCase());
    const newEmails: NewEmailCard[] = [];
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

      const bedCode = bedCodes.find(code => (email.subject + " " + email.body).toUpperCase().includes(code)) ?? null;
      const bed = bedCode ? allBeds.find(b => b.code.toUpperCase() === bedCode) : undefined;
      const isAlta = /alta|egreso|libre/i.test(email.subject);
      const isThread = !!thread.parentMessageId;

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

      newEmails.push({
        id: msg.id,
        fromName: email.fromName,
        fromAddress: email.fromAddress,
        subject: email.subject,
        preview: email.body.substring(0, 120).replace(/\n/g, " ").trim(),
        receivedAt: email.receivedAt,
        bedCode: bed?.code ?? null,
        isAlta,
        isThread,
        threadKey: thread.threadKey,
      });
    }

    if (maxUid > (lastUid || 0)) {
      await db.insert(settings).values({ key: "mail_last_synced_uid", value: maxUid.toString() })
        .onConflictDoUpdate({ target: settings.key, set: { value: maxUid.toString() } });
    }

    return { ok: true, newEmails, message: `${newEmails.length} nuevos.` };
  } catch (e) {
    return { ok: false, newEmails: [], message: e instanceof Error ? e.message : "Error desconocido" };
  }
}

/* ------------------------------------------------------------------ */
/*  TARJETAS DE CORREO EN TELEGRAM                                     */
/* ------------------------------------------------------------------ */

type NewEmailCard = {
  id: number;
  fromName: string;
  fromAddress: string;
  subject: string;
  preview: string;
  receivedAt: Date;
  bedCode: string | null;
  isAlta: boolean;
  isThread: boolean;
  threadKey: string;
};

function buildEmailCard(card: NewEmailCard, appUrl: string): string {
  const timeAgo = (ms: number) => {
    const m = Math.round(ms / 60000);
    if (m < 60) return `hace ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h} h`;
    return `hace ${Math.floor(h / 24)} días`;
  };

  const ago = timeAgo(Date.now() - card.receivedAt.getTime());
  const threadIcon = card.isThread ? "🔗" : "✉️";
  const alertIcon = card.isAlta ? "🚨" : (card.bedCode ? "🛏" : "📬");

  let text = `${alertIcon} ${threadIcon} <b>${card.subject}</b>\n`;
  text += `👤 <i>${card.fromName}</i> · ${ago}\n`;

  if (card.bedCode) text += `🏥 Cama: <b>${card.bedCode}</b>\n`;
  if (card.isAlta) text += `⚠️ <b>AVISO DE ALTA DETECTADO</b>\n`;
  if (card.isThread) text += `🔗 <i>Respuesta en hilo existente</i>\n`;

  text += `\n<blockquote>${card.preview}…</blockquote>`;
  text += `\n\n🔗 <a href="${appUrl}/bandeja/${card.id}">Ver en Copiloto</a> | /descartar_${card.id}`;

  return text;
}

/* ------------------------------------------------------------------ */
/*  PROCESAMIENTO DE MENSAJE ENTRANTE DE TELEGRAM                      */
/* ------------------------------------------------------------------ */

export async function processIncomingMessage(opts: {
  chatId: string;
  text?: string;
  voiceId?: string;
  fromName: string;
}) {
  const rawText = (opts.text || "").trim();
  if (!rawText) return;

  const normalized = rawText.toLowerCase();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // ─── COMANDO: descartar correo ────────────────────────────────────
  const discardMatch = rawText.match(/^\/descartar_(\d+)$/i);
  if (discardMatch) {
    const msgId = parseInt(discardMatch[1], 10);
    try {
      await db.update(messages)
        .set({ status: "no_aplica" })
        .where(eq(messages.id, msgId));
      await sendMessage(opts.chatId, `🗑 Correo #${msgId} descartado y marcado como "no aplica".`);
    } catch {
      await sendMessage(opts.chatId, `❌ No se pudo descartar el correo #${msgId}.`);
    }
    return;
  }

  // ─── COMANDO: ayuda ───────────────────────────────────────────────
  if (normalized === "ayuda" || normalized === "help" || normalized === "comandos") {
    await sendMessage(opts.chatId,
      `<b>📋 Copiloto de Camas — Comandos</b>\n\n` +
      `<b>📬 Correo</b>\n` +
      `• <b>sincronizar</b> — revisar correo nuevo\n` +
      `• <b>correos pendientes</b> — sin responder\n` +
      `• <b>correos prioritarios</b> — de contactos clave\n` +
      `• <i>/descartar_ID</i> — descartar correo irrelevante\n\n` +
      `<b>🏥 Operativo</b>\n` +
      `• <b>camas disponibles</b> — capacidad actual\n` +
      `• <b>resumen del turno</b> — estado general\n` +
      `• <b>sync hoja</b> — revisar la hoja del turno\n\n` +
      `<b>ℹ️ General</b>\n` +
      `• <b>ayuda</b> — esta lista\n` +
      `• Cualquier pregunta en lenguaje natural\n\n` +
      `<i>Cuando llega un correo nuevo, lo recibes como tarjeta con link directo y botón de descarte.</i>`
    );
    return;
  }

  // ─── COMANDO: sincronizar correo ──────────────────────────────────
  if (["sync", "sincronizar", "sincronizar correo", "revisar correo"].includes(normalized)) {
    await sendMessage(opts.chatId, "⏳ Revisando correos nuevos...");

    let result: { ok: boolean; newEmails: NewEmailCard[]; message: string };
    try {
      result = await runMailSync();
    } catch (syncError) {
      await sendMessage(opts.chatId, `❌ Error de sincronización: ${syncError instanceof Error ? syncError.message : "desconocido"}. Prueba desde la web /bandeja.`);
      return;
    }

    if (!result.ok) {
      await sendMessage(opts.chatId, `❌ Error al sincronizar: ${result.message}`);
      return;
    }

    if (result.newEmails.length === 0) {
      await sendMessage(opts.chatId,
        `✅ <b>Sin correos nuevos</b>\n\n` +
        `La bandeja está al día. Recibirás una tarjeta aquí cuando llegue algo nuevo.`
      );
      return;
    }

    // Enviar tarjeta por cada correo nuevo
    await sendMessage(opts.chatId, `📬 <b>${result.newEmails.length} correo(s) nuevo(s):</b>`);

    for (const card of result.newEmails) {
      const cardText = buildEmailCard(card, appUrl);
      await sendMessage(opts.chatId, cardText, {
        reply_markup: {
          inline_keyboard: [[
            { text: "📂 Ver completo", url: `${appUrl}/bandeja/${card.id}` },
            { text: "🗑 Descartar", callback_data: `discard_${card.id}` },
          ]]
        }
      });
      // Pequeña pausa para no saturar Telegram (rate limit)
      await new Promise(r => setTimeout(r, 400));
    }
    return;
  }

  // ─── COMANDO: sync hoja ───────────────────────────────────────────
  if (["sync hoja", "sincronizar hoja", "revisar hoja"].includes(normalized)) {
    await sendMessage(opts.chatId, "⏳ Sincronizando hoja del turno...");
    try {
      const res = await fetch(`${appUrl}/api/sheets/sync`, { method: "POST" });
      const result = await res.json() as { ok: boolean; message: string };
      await sendMessage(opts.chatId, result.ok ? `✅ ${result.message}` : `❌ ${result.message}`);
    } catch {
      await sendMessage(opts.chatId, "❌ Error al sincronizar la hoja.");
    }
    return;
  }

  // ─── COMANDO: correos pendientes ──────────────────────────────────
  if (normalized.includes("correos sin responder") || normalized.includes("correos pendientes")) {
    const daysMatch = normalized.match(/(\d+)\s*d[ií]as?/);
    const days = daysMatch ? Number(daysMatch[1]) : 30;
    const emails = await getUnansweredEmails({ days });

    if (emails.length === 0) {
      await sendMessage(opts.chatId, `✅ No hay correos sin responder en los últimos ${days} días.`);
      return;
    }

    let report = `<b>📧 CORREOS SIN RESPONDER (${days} días)</b>\n\n`;
    emails.forEach(e => {
      const daysAgo = Math.max(0, Math.round((Date.now() - e.receivedAt.getTime()) / 86400000));
      report += `• <b>${e.fromName}</b>\n  ${e.subject}\n  Hace ${daysAgo} día(s)\n  <a href="${appUrl}/bandeja/${e.id}">Ver →</a>\n\n`;
    });
    await sendMessage(opts.chatId, report);
    return;
  }

    // ─── COMANDO: correos prioritarios ────────────────────────────────
    if (normalized.includes("correos importantes") || normalized.includes("correos prioritarios")) {
      const alerts = await getPriorityAlerts();
      if (alerts.length === 0) {
        await sendMessage(opts.chatId, "✅ No hay correos pendientes de contactos prioritarios.");
        return;
      }
      let report = `<b>⚠️ CORREOS PRIORITARIOS SIN RESPONDER</b>\n\n`;
      alerts.slice(0, 8).forEach(a => {
        report += `• <b>${a.fromName}</b>\n  ${a.subject}\n\n`;
      });
      
      // Agregamos botones interactivos para gestionar estas alertas desde Telegram
      await sendMessage(opts.chatId, report, {
        reply_markup: {
          inline_keyboard: alerts.slice(0, 3).map(a => [
            { text: `✍️ Redactar respuesta a ${a.fromName.split(" ")[0]}`, callback_data: `draft_reply_${a.id}` }
          ])
        }
      });
      return;
    }

  // ─── COMANDO: disponibilidad / resumen ────────────────────────────
  if (
    normalized.includes("camas disponibles") ||
    normalized.includes("qué hay disponible") ||
    normalized.includes("resumen del turno") ||
    normalized.includes("pendientes")
  ) {
    const context = await getSystemContextForAI();
    await sendMessage(opts.chatId, context);
    return;
  }

  // ─── COMANDO EJECUTIVO: Camas Estancadas / Auditoría ─────────────
  if (
    normalized.includes("camas estancadas") ||
    normalized.includes("camas en uso") ||
    normalized.includes("auditoria") ||
    normalized.includes("auditoría")
  ) {
    await sendMessage(opts.chatId, "🔍 Buscando camas con estadía prolongada...");
    
    // Buscar camas ocupadas por más de 5 días
    const daysThreshold = 5;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

    const staleBeds = await db.select()
      .from(beds)
      .where(
        and(
          eq(beds.status, "occupied"),
          lte(beds.statusSince, cutoffDate)
        )
      );

    if (staleBeds.length === 0) {
      await sendMessage(opts.chatId, `✅ No hay camas ocupadas por más de ${daysThreshold} días sin movimiento.`);
      return;
    }

    await sendMessage(opts.chatId, `⚠️ Encontré ${staleBeds.length} cama(s) ocupada(s) por más de ${daysThreshold} días:`);

    for (const bed of staleBeds.slice(0, 10)) {
      const daysInStatus = Math.round((Date.now() - bed.statusSince.getTime()) / (1000 * 60 * 60 * 24));
      const text = `🛏 <b>Cama: ${bed.code}</b>\n` +
                   `Unidad: ${bed.unit}\n` +
                   `Estado: Ocupada por ${daysInStatus} días\n\n` +
                   `¿Deseas proponer su liberación?`;
      
      await sendMessage(opts.chatId, text, {
        reply_markup: {
          inline_keyboard: [[
            { text: "👁 Detectar Alta", callback_data: `propose_discharge_${bed.id}` }
          ]]
        }
      });
      await new Promise(r => setTimeout(r, 300)); // Rate limit
    }
    return;
  }

  // ─── FALLBACK: LLM conversacional ────────────────────────────────
  try {
    const systemContext = await getSystemContextForAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres el Agente Ejecutivo del Copiloto de Camas. Tono ejecutivo, claro, resolutivo. No inventas datos. No tomas decisiones clínicas.\n\nContexto actual:\n${systemContext}`
        },
        { role: "user", content: rawText }
      ],
      temperature: 0.4,
    });

    const reply = response.choices[0]?.message?.content;
    if (reply) {
      await sendMessage(opts.chatId, reply);
    } else {
      await sendMessage(opts.chatId, "¿Puedes reformular la consulta?");
    }
  } catch (error) {
    console.error("AI FALLBACK ERROR:", error);
    await sendMessage(opts.chatId, "No pude procesar la consulta. Prueba con un comando como <b>ayuda</b>.");
  }
}