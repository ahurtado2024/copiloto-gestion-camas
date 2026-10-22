/* ------------------------------------------------------------------ */
/*  AGENTE TELEGRAM — Ejecutivo + Operativo                            */
/*  Texto + Audio + Tarjetas de Correo + Tarjetas de Camas            */
/* ------------------------------------------------------------------ */

import OpenAI from "openai";
import { sendMessage, getFileUrl } from "./telegram";
import { getUnansweredEmails, getPriorityAlerts } from "./executive";
import { getSystemContextForAI, loadBeds } from "./queries";
import { db } from "@/db";
import { messages, settings, beds } from "@/db/schema";
import { eq, and, lte } from "drizzle-orm";
import { resolveThread } from "./email-threading";
import { fetchInbox } from "./mail";
import { proposeDischarge } from "./engine";
import { BED_STATE_META, type BedStatus } from "./domain";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ------------------------------------------------------------------ */
/*  TIPOS                                                              */
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

type BedCardRow = {
  id: number;
  code: string;
  unit: string;
  status: string;
  statusSince: Date;
  note: string | null;
  establishmentId: number;
  bedType: string;
  lastConfirmedAt: Date;
};

/* ------------------------------------------------------------------ */
/*  UTILIDADES                                                         */
/* ------------------------------------------------------------------ */

function timeAgoHuman(date: Date): string {
  const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

function splitLongText(text: string, chunkSize = 3500): string[] {
  if (text.length <= chunkSize) return [text];
  const chunks: string[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    if ((current + line + "\n").length > chunkSize) {
      chunks.push(current);
      current = "";
    }
    current += line + "\n";
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

/* ------------------------------------------------------------------ */
/*  AUDIO → TEXTO (Whisper)                                            */
/* ------------------------------------------------------------------ */

async function transcribeVoice(fileId: string): Promise<string | null> {
  try {
    const fileUrl = await getFileUrl(fileId);
    if (!fileUrl) return null;

    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) return null;

    const arrayBuffer = await fileResponse.arrayBuffer();
    const file = new File([arrayBuffer], "voice.ogg", { type: "audio/ogg" });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });

    return transcription.text?.trim() || null;
  } catch (error) {
    console.error("WHISPER ERROR:", error);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  TARJETAS DE CORREO                                                 */
/* ------------------------------------------------------------------ */

function buildEmailCard(card: NewEmailCard, appUrl: string): string {
  const threadIcon = card.isThread ? "🔗" : "✉️";
  const alertIcon = card.isAlta ? "🚨" : (card.bedCode ? "🛏" : "📬");

  let text = `${alertIcon} ${threadIcon} <b>${card.subject}</b>\n`;
  text += `👤 <i>${card.fromName}</i> · ${timeAgoHuman(card.receivedAt)}\n`;

  if (card.bedCode) text += `🏥 Cama: <b>${card.bedCode}</b>\n`;
  if (card.isAlta) text += `⚠️ <b>AVISO DE ALTA DETECTADO</b>\n`;
  if (card.isThread) text += `🔗 <i>Respuesta en hilo existente</i>\n`;

  text += `\n<blockquote>${card.preview}…</blockquote>`;
  text += `\n\n<a href="${appUrl}/bandeja/${card.id}">Ver en Copiloto</a>`;

  return text;
}

/* ------------------------------------------------------------------ */
/*  TARJETAS DE CAMAS                                                  */
/* ------------------------------------------------------------------ */

function buildBedCard(bed: BedCardRow, estCode?: string): string {
  const status = bed.status as BedStatus;
  const meta = BED_STATE_META[status] ?? null;
  const statusLabel = meta?.label ?? bed.status;
  const age = timeAgoHuman(bed.statusSince);
  const freshness = timeAgoHuman(bed.lastConfirmedAt);

  let text = `🛏 <b>${bed.code}</b>\n`;
  text += `📍 ${bed.unit}${estCode ? ` · ${estCode}` : ""}\n`;
  text += `🏷 Estado: <b>${statusLabel}</b>\n`;
  text += `⏱ En este estado: ${age}\n`;
  text += `🧭 Última confirmación: ${freshness}\n`;

  if (bed.note) {
    text += `📝 <i>${bed.note}</i>\n`;
  }

  return text;
}

function buildBedKeyboard(bed: BedCardRow, appUrl: string) {
  const rows: { text: string; callback_data?: string; url?: string }[][] = [];

  if (bed.status === "occupied" || bed.status === "unknown") {
    rows.push([{ text: "👁 Detectar Alta", callback_data: `propose_discharge_${bed.id}` }]);
  }

  if (bed.status === "available") {
    rows.push([{ text: "📌 Reservar", callback_data: `reserve_bed_${bed.id}` }]);
  }

  rows.push([{ text: "📂 Ver en Copiloto", url: `${appUrl}/camas/${bed.code}` }]);

  return { inline_keyboard: rows };
}

/* ------------------------------------------------------------------ */
/*  SINCRONIZACIÓN DIRECTA DE CORREO                                   */
/* ------------------------------------------------------------------ */

async function runMailSync(): Promise<{ ok: boolean; newEmails: NewEmailCard[]; message: string }> {
  try {
    const [lastUidRow] = await db.select().from(settings).where(eq(settings.key, "mail_last_synced_uid"));
    const lastUid = lastUidRow ? parseInt(lastUidRow.value, 10) : undefined;

    const mailResult = await fetchInbox(lastUid);
    if (!mailResult.ok) return { ok: false, newEmails: [], message: mailResult.error || "Error IMAP" };
    if (mailResult.emails.length === 0) return { ok: true, newEmails: [], message: "" };

    const allBeds = await db.select({ id: beds.id, code: beds.code, unit: beds.unit }).from(beds);
    const bedCodes = allBeds.map((b) => b.code.toUpperCase());
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

      const bedCode = bedCodes.find((code) =>
        (email.subject + " " + email.body).toUpperCase().includes(code)
      ) ?? null;

      const bed = bedCode
        ? allBeds.find((b) => b.code.toUpperCase() === bedCode)
        : undefined;

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
      await db.insert(settings).values({
        key: "mail_last_synced_uid",
        value: maxUid.toString(),
      }).onConflictDoUpdate({
        target: settings.key,
        set: { value: maxUid.toString() },
      });
    }

    return { ok: true, newEmails, message: `${newEmails.length} nuevos.` };
  } catch (e) {
    return { ok: false, newEmails: [], message: e instanceof Error ? e.message : "Error desconocido" };
  }
}

/* ------------------------------------------------------------------ */
/*  CONSULTA DE CAMAS POR FILTRO                                       */
/* ------------------------------------------------------------------ */

async function listBedsByFilter(filter: {
  status?: BedStatus[];
  bedType?: string;
  establishmentContains?: string;
  unitContains?: string;
  limit?: number;
}) {
  const now = new Date();
  const { beds: loadedBeds, ests } = await loadBeds(now);

  let result = loadedBeds;

  if (filter.status?.length) {
    result = result.filter((b) => filter.status!.includes(b.status as BedStatus));
  }

  if (filter.bedType) {
    result = result.filter((b) => b.bedType === filter.bedType);
  }

  if (filter.establishmentContains) {
    const q = filter.establishmentContains.toLowerCase();
    result = result.filter((b) => b.estName.toLowerCase().includes(q) || b.estCode.toLowerCase().includes(q));
  }

  if (filter.unitContains) {
    const q = filter.unitContains.toLowerCase();
    result = result.filter((b) => b.unit.toLowerCase().includes(q));
  }

  result = result.slice(0, filter.limit ?? 8);

  const estMap = new Map(ests.map((e) => [e.id, e.code]));
  return result.map((b) => ({
    id: b.id,
    code: b.code,
    unit: b.unit,
    status: b.status,
    statusSince: b.statusSince,
    note: b.note,
    establishmentId: b.establishmentId,
    bedType: b.bedType,
    lastConfirmedAt: b.lastConfirmedAt,
    estCode: estMap.get(b.establishmentId),
  }));
}

/* ------------------------------------------------------------------ */
/*  PROCESAMIENTO DE MENSAJES                                          */
/* ------------------------------------------------------------------ */

export async function processIncomingMessage(opts: {
  chatId: string;
  text?: string;
  voiceId?: string;
  fromName: string;
}) {
  let userText = (opts.text || "").trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // ─── AUDIO → TEXTO ────────────────────────────────────────────────
  if (opts.voiceId) {
    await sendMessage(opts.chatId, "🎧 Escuchando audio...");
    const transcript = await transcribeVoice(opts.voiceId);
    if (!transcript) {
      await sendMessage(opts.chatId, "❌ No pude entender el audio.");
      return;
    }
    userText = transcript;
    await sendMessage(opts.chatId, `💬 <i>\"${userText}\"</i>`);
  }

  if (!userText) return;
  const rawText = userText;
  const normalized = rawText.toLowerCase().trim();

  // ─── DESCARTAR CORREO ─────────────────────────────────────────────
  const discardMatch = rawText.match(/^\/descartar_(\d+)$/i);
  if (discardMatch) {
    const msgId = parseInt(discardMatch[1], 10);
    try {
      await db.update(messages).set({ status: "no_aplica" }).where(eq(messages.id, msgId));
      await sendMessage(opts.chatId, `🗑 Correo #${msgId} descartado y marcado como “no aplica”.`);
    } catch {
      await sendMessage(opts.chatId, `❌ No se pudo descartar el correo #${msgId}.`);
    }
    return;
  }

  // ─── AYUDA ────────────────────────────────────────────────────────
  if (normalized === "ayuda" || normalized === "help" || normalized === "comandos") {
    await sendMessage(
      opts.chatId,
      `<b>📋 Copiloto de Camas — Comandos</b>\n\n` +
      `<b>📬 Correo</b>\n` +
      `• <b>sincronizar</b> — revisar correo nuevo\n` +
      `• <b>correos pendientes</b> — sin responder\n` +
      `• <b>correos prioritarios</b> — de contactos clave\n` +
      `• <i>/descartar_ID</i> — descartar correo irrelevante\n\n` +
      `<b>🏥 Camas</b>\n` +
      `• <b>camas disponibles</b>\n` +
      `• <b>camas ocupadas</b>\n` +
      `• <b>camas en limpieza</b>\n` +
      `• <b>camas pendientes</b>\n` +
      `• <b>camas estancadas</b>\n` +
      `• <b>todas las camas</b>\n\n` +
      `<b>📊 General</b>\n` +
      `• <b>resumen del turno</b>\n` +
      `• <b>sync hoja</b>\n` +
      `• Puedes enviar <b>audio</b> además de texto.\n`
    );
    return;
  }

  // ─── SINCRONIZAR CORREO ───────────────────────────────────────────
  if (["sync", "sincronizar", "sincronizar correo", "revisar correo"].includes(normalized)) {
    await sendMessage(opts.chatId, "⏳ Revisando correos nuevos...");
    let result: { ok: boolean; newEmails: NewEmailCard[]; message: string };
    try {
      result = await runMailSync();
    } catch (syncError) {
      await sendMessage(opts.chatId, `❌ Error de sincronización: ${syncError instanceof Error ? syncError.message : "desconocido"}.`);
      return;
    }

    if (!result.ok) {
      await sendMessage(opts.chatId, `❌ Error al sincronizar: ${result.message}`);
      return;
    }

    if (result.newEmails.length === 0) {
      await sendMessage(opts.chatId, `✅ <b>Sin correos nuevos</b>\n\nLa bandeja está al día.`);
      return;
    }

    await sendMessage(opts.chatId, `📬 <b>${result.newEmails.length} correo(s) nuevo(s)</b>`);
    for (const card of result.newEmails) {
      const cardText = buildEmailCard(card, appUrl);
      await sendMessage(opts.chatId, cardText, {
        reply_markup: {
          inline_keyboard: [[
            { text: "📂 Ver completo", url: `${appUrl}/bandeja/${card.id}` },
            { text: "🗑 Descartar", callback_data: `discard_${card.id}` },
          ]],
        },
      });
      await new Promise((r) => setTimeout(r, 400));
    }
    return;
  }

  // ─── SINCRONIZAR HOJA ─────────────────────────────────────────────
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

  // ─── CORREOS PENDIENTES ───────────────────────────────────────────
  if (normalized.includes("correos sin responder") || normalized.includes("correos pendientes")) {
    const daysMatch = normalized.match(/(\d+)\s*d[ií]as?/);
    const days = daysMatch ? Number(daysMatch[1]) : 30;
    const emails = await getUnansweredEmails({ days });

    if (emails.length === 0) {
      await sendMessage(opts.chatId, `✅ No hay correos sin responder en los últimos ${days} días.`);
      return;
    }

    let report = `<b>📧 CORREOS SIN RESPONDER (${days} días)</b>\n\n`;
    emails.forEach((e) => {
      const daysAgo = Math.max(0, Math.round((Date.now() - e.receivedAt.getTime()) / 86400000));
      report += `• <b>${e.fromName}</b>\n${e.subject}\nHace ${daysAgo} día(s)\n<a href="${appUrl}/bandeja/${e.id}">Ver →</a>\n\n`;
    });
    await sendMessage(opts.chatId, report);
    return;
  }

  // ─── CORREOS PRIORITARIOS ─────────────────────────────────────────
  if (normalized.includes("correos importantes") || normalized.includes("correos prioritarios")) {
    const alerts = await getPriorityAlerts();
    if (alerts.length === 0) {
      await sendMessage(opts.chatId, "✅ No hay correos pendientes de contactos prioritarios.");
      return;
    }

    let report = `<b>⚠️ CORREOS PRIORITARIOS SIN RESPONDER</b>\n\n`;
    alerts.slice(0, 8).forEach((a) => {
      report += `• <b>${a.fromName}</b>\n${a.subject}\n\n`;
    });

    await sendMessage(opts.chatId, report, {
      reply_markup: {
        inline_keyboard: alerts.slice(0, 3).map((a) => [
          { text: `✍️ Redactar respuesta a ${a.fromName.split(" ")[0]}`, callback_data: `draft_reply_${a.id}` }
        ])
      }
    });
    return;
  }

  // ─── CAMAS POR FILTRO (tarjetas individuales) ────────────────────
  const isBedIntent =
    normalized.includes("camas") ||
    normalized.includes("cama") ||
    normalized.includes("disponibles") ||
    normalized.includes("ocupadas") ||
    normalized.includes("limpieza") ||
    normalized.includes("pendientes") ||
    normalized.includes("bloqueadas") ||
    normalized.includes("todas las camas");

  if (isBedIntent) {
    let filter: {
      status?: BedStatus[];
      bedType?: string;
      establishmentContains?: string;
      unitContains?: string;
      limit?: number;
    } = { limit: 8 };

    let title = "Informe de Camas";

    if (normalized.includes("disponibles") || normalized.includes("libres")) {
      filter.status = ["available"];
      title = "Camas Disponibles";
    } else if (normalized.includes("ocupadas") || normalized.includes("en uso")) {
      filter.status = ["occupied"];
      title = "Camas Ocupadas";
    } else if (normalized.includes("limpieza") || normalized.includes("aseo")) {
      filter.status = ["pending_cleaning", "cleaning", "cleaning_completed"];
      title = "Camas en Proceso de Aseo";
    } else if (normalized.includes("pendientes") || normalized.includes("inspección")) {
      filter.status = ["pending_inspection", "discharge_detected"];
      title = "Camas con Acción Pendiente";
    } else if (normalized.includes("bloqueadas") || normalized.includes("fuera de servicio")) {
      filter.status = ["blocked", "out_of_service"];
      title = "Camas No Operativas";
    } else if (normalized.includes("vencidas")) {
      title = "Camas con Dato Vencido";
      // Lo resolveremos desde loadBeds porque stale es calculado, no persistido
      const bedViews = (await loadBeds(new Date())).beds.filter((b) => b.stale).slice(0, 8);
      if (bedViews.length === 0) {
        await sendMessage(opts.chatId, `✅ No hay camas con dato vencido.`);
        return;
      }
      await sendMessage(opts.chatId, `📋 <b>${title} (${bedViews.length})</b>`);
      for (const bed of bedViews) {
        await sendMessage(opts.chatId, buildBedCard(bed, bed.estCode), {
          reply_markup: buildBedKeyboard(bed, appUrl),
        });
        await new Promise((r) => setTimeout(r, 300));
      }
      return;
    }

    if (normalized.includes("uci") || normalized.includes("uti") || normalized.includes("crítica")) {
      filter.bedType = "critica";
      title += " Críticas";
    }
    if (normalized.includes("hrr") || normalized.includes("rancagua")) {
      filter.establishmentContains = "HRR";
      title += " · HRR";
    }
    if (normalized.includes("hsf") || normalized.includes("san fernando")) {
      filter.establishmentContains = "HSF";
      title += " · HSF";
    }
    if (normalized.includes("srg") || normalized.includes("rengo")) {
      filter.establishmentContains = "SRG";
      title += " · SRG";
    }
    if (normalized.includes("medicina 3")) {
      filter.unitContains = "Medicina 3";
      title += " · Medicina 3";
    }
    if (normalized.includes("cirugía 2") || normalized.includes("cirugia 2")) {
      filter.unitContains = "Cirugía 2";
      title += " · Cirugía 2";
    }

    const rows = await listBedsByFilter(filter);
    if (rows.length === 0) {
      await sendMessage(opts.chatId, `✅ No encontré resultados para: <b>${title}</b>.`);
      return;
    }

    await sendMessage(opts.chatId, `📋 <b>${title} (${rows.length})</b>`);
    for (const bed of rows) {
      await sendMessage(opts.chatId, buildBedCard(bed, bed.estCode), {
        reply_markup: buildBedKeyboard(bed, appUrl),
      });
      await new Promise((r) => setTimeout(r, 300));
    }
    return;
  }

  // ─── CAMAS ESTANCADAS / AUDITORÍA ─────────────────────────────────
  if (
    normalized.includes("camas estancadas") ||
    normalized.includes("auditoria") ||
    normalized.includes("auditoría")
  ) {
    await sendMessage(opts.chatId, "🔍 Buscando camas con estadía prolongada...");

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
      const estCode = "";
      const card = buildBedCard(bed as any, estCode);
      await sendMessage(opts.chatId, card + `\n¿Deseas proponer su liberación?`, {
        reply_markup: {
          inline_keyboard: [[
            { text: "👁 Detectar Alta", callback_data: `propose_discharge_${bed.id}` }
          ]]
        }
      });
      await new Promise((r) => setTimeout(r, 300));
    }
    return;
  }

  // ─── FALLBACK CONVERSACIONAL ──────────────────────────────────────
  try {
    const systemContext = await getSystemContextForAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres el Agente Ejecutivo del Copiloto de Camas. Tono ejecutivo, claro, resolutivo. No inventas datos. No tomas decisiones clínicas.\n\nContexto actual:\n${systemContext}`,
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
    await sendMessage(opts.chatId, "No pude procesar la consulta. Prueba con <b>ayuda</b>.");
  }
}