/* ------------------------------------------------------------------ */
/*  AGENTE EJECUTIVO INTELIGENTE                                       */
/*  Router determinista para comandos + Fallback con LLM.              */
/* ------------------------------------------------------------------ */

import OpenAI from "openai";
import { sendMessage } from "./telegram";
import { getUnansweredEmails, getPriorityAlerts } from "./executive";
import { getSystemContextForAI } from "./queries";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function processIncomingMessage(opts: {
  chatId: string;
  text?: string;
  voiceId?: string;
  fromName: string;
}) {
  let userText = (opts.text || "").trim();

  // [Simulamos transcripción de audio aquí por brevedad]
  if (opts.voiceId) {
    userText = "[Audio: Función de transcripción pendiente]";
  }

  if (!userText) return;

  const normalized = userText.toLowerCase();

  try {
    // --- 1. COMANDOS DIRECTOS EXPLICITOS ---

    if (normalized === "sync" || normalized === "sincronizar" || normalized === "sincronizar correo") {
      await sendMessage(opts.chatId, "⏳ Sincronizando correo...");
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const res = await fetch(`${appUrl}/api/mail/sync`, { method: "POST" });
      const result = await res.json();
      await sendMessage(opts.chatId, result.ok ? `✅ ${result.message}` : `❌ ${result.message}`);
      return;
    }

    if (normalized === "sync hoja" || normalized === "sincronizar hoja") {
      await sendMessage(opts.chatId, "⏳ Sincronizando hoja del turno...");
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const res = await fetch(`${appUrl}/api/sheets/sync`, { method: "POST" });
      const result = await res.json();
      await sendMessage(opts.chatId, result.ok ? `✅ ${result.message}` : `❌ ${result.message}`);
      return;
    }

    if (normalized === "ayuda" || normalized === "help" || normalized === "comandos") {
      await sendMessage(
        opts.chatId,
        `<b>📋 Comandos del Copiloto</b>\n\n` +
        `• <b>sincronizar</b> — revisar correo nuevo\n` +
        `• <b>sync hoja</b> — revisar la hoja del turno\n` +
        `• <b>camas disponibles</b> — capacidad actual\n` +
        `• <b>correos pendientes</b> — sin responder\n` +
        `• <b>correos prioritarios</b> — de contactos clave\n` +
        `• <b>resumen del turno</b> — estado general\n` +
        `• <b>ayuda</b> — esta lista\n\n` +
        `También puedes preguntar en lenguaje natural.`
      );
      return;
    }

    // --- 2. INTENCIONES EJECUTIVAS (Router Determinista) ---

    // Correos resagados
    if (normalized.includes("correos sin responder") || normalized.includes("correos pendientes")) {
      const daysMatch = normalized.match(/(\d+)\s*d[ií]as?/);
      const days = daysMatch ? Number(daysMatch[1]) : 30;
      const emails = await getUnansweredEmails({ days });

      if (emails.length === 0) {
        await sendMessage(opts.chatId, `No encontré correos sin responder en los últimos ${days} días.`);
        return;
      }

      let report = `<b>📧 CORREOS SIN RESPONDER (${days} días)</b>\n\n`;
      emails.forEach((e) => {
        const daysAgo = Math.max(0, Math.round((Date.now() - e.receivedAt.getTime()) / (1000 * 60 * 60 * 24)));
        report += `• <b>${e.fromName}</b>\nAsunto: ${e.subject}\nHace ${daysAgo} día(s)\n\n`;
      });
      await sendMessage(opts.chatId, report);
      return;
    }

    // Alertas de red (Contactos Prioritarios)
    if (normalized.includes("correos importantes") || normalized.includes("correos prioritarios")) {
      const alerts = await getPriorityAlerts();
      if (alerts.length === 0) {
        await sendMessage(opts.chatId, "No hay correos pendientes de contactos prioritarios.");
        return;
      }

      let report = `<b>⚠️ CORREOS PRIORITARIOS SIN RESPONDER</b>\n\n`;
      alerts.slice(0, 10).forEach((a) => {
        report += `• <b>${a.fromName}</b>\nAsunto: ${a.subject}\n\n`;
      });
      await sendMessage(opts.chatId, report);
      return;
    }

    // Resumen Operativo / Disponibilidad
    if (
      normalized.includes("camas disponibles") ||
      normalized.includes("qué hay disponible") ||
      normalized.includes("resumen del turno") ||
      normalized.includes("pendientes del turno")
    ) {
      const context = await getSystemContextForAI();
      await sendMessage(opts.chatId, context);
      return;
    }

    // --- 3. FALLBACK CONVERSACIONAL (LLM) ---

    const systemContext = await getSystemContextForAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres el Agente Ejecutivo del Copiloto de Camas.
          Tu tono es ejecutivo, claro y resolutivo.
          No inventas datos. No tomas decisiones clínicas.
          Respondes usando este contexto real del sistema:
          
          ${systemContext}`
        },
        { role: "user", content: userText }
      ],
      temperature: 0.4,
    });

    const reply = response.choices[0]?.message?.content;
    if (reply) {
      await sendMessage(opts.chatId, reply);
    } else {
      await sendMessage(opts.chatId, "No pude procesar la respuesta. ¿Puedes reformular la consulta?");
    }

  } catch (error) {
    console.error("AI EXECUTIVE ERROR:", error);
    await sendMessage(opts.chatId, "Error en el asistente ejecutivo. Reintenta en unos segundos.");
  }
}
