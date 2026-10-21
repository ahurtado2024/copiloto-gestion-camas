/* ------------------------------------------------------------------ */
/*  AGENTE EJECUTIVO INTELIGENTE                                       */
/*  Capaz de gestionar borradores, contactos y deudas de red.         */
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

  if (opts.voiceId) {
    userText = "[Audio recibido: función de transcripción pendiente]";
  }

  if (!userText) return;

  const normalized = userText.toLowerCase();

  try {
    // 1. Correos resagados por rango
    if (
      normalized.includes("correos sin responder") ||
      normalized.includes("correos pendientes") ||
      normalized.includes("listado de correos")
    ) {
      const daysMatch = normalized.match(/(\d+)\s*d[ií]as?/);
      const days = daysMatch ? Number(daysMatch[1]) : 30;
      const emails = await getUnansweredEmails({ days });

      if (emails.length === 0) {
        await sendMessage(opts.chatId, "No encontré correos sin responder en ese rango.");
        return;
      }

      let report = `<b>📧 CORREOS SIN RESPONDER (${days} días)</b>\n\n`;
      emails.forEach((e) => {
        const daysAgo = Math.max(
          0,
          Math.round((Date.now() - e.receivedAt.getTime()) / (1000 * 60 * 60 * 24))
        );
        report += `• <b>${e.fromName}</b>\nAsunto: ${e.subject}\nHace ${daysAgo} día(s)\n\n`;
      });

      await sendMessage(opts.chatId, report);
      return;
    }

    // 2. Alertas prioritarias
    if (
      normalized.includes("correos importantes") ||
      normalized.includes("correos prioritarios") ||
      normalized.includes("deudas de red") ||
      normalized.includes("hospitales pendientes")
    ) {
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

    // 3. Disponibilidad / resumen operativo
    if (
      normalized.includes("camas disponibles") ||
      normalized.includes("hay camas") ||
      normalized.includes("qué hay disponible") ||
      normalized.includes("resumen del turno") ||
      normalized.includes("pendientes del turno")
    ) {
      const context = await getSystemContextForAI();
      await sendMessage(opts.chatId, context);
      return;
    }

    // 4. Fallback natural con OpenAI
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

${systemContext}
`,
        },
        {
          role: "user",
          content: userText,
        },
      ],
      temperature: 0.4,
    });

    const reply = response.choices[0]?.message?.content;
    if (reply) {
      await sendMessage(opts.chatId, reply);
    } else {
      await sendMessage(opts.chatId, "No pude preparar una respuesta útil. ¿Puedes reformular la consulta?");
    }
  } catch (error) {
    console.error("AI EXECUTIVE ERROR:", error);
    await sendMessage(opts.chatId, "Error en el asistente ejecutivo. Reintenta en unos segundos.");
  }
}
