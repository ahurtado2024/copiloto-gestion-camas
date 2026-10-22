/* ------------------------------------------------------------------ */
/*  AGENTE EJECUTIVO INTELIGENTE                                       */
/*  Capaz de gestionar borradores, contactos y deudas de red.         */
/* ------------------------------------------------------------------ */

import OpenAI from "openai";
import { sendMessage } from "./telegram";
import { getUnansweredEmails, getPriorityAlerts } from "./executive";
import { getSystemContextForAI } from "./queries"; // Reutilizamos lógica de consultas
import { draftReply, logEvent } from "./engine";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function processIncomingMessage(opts: {
  chatId: string;
  text?: string;
  voiceId?: string;
  fromName: string;
}) {
  let userText = opts.text || "";

  // [Simulamos transcripción de audio aquí por brevedad]
  if (opts.voiceId) {
    userText = "[Audio: Favor resumir correos pendientes del Hospital San Fernando]";
  }

  if (!userText) return;

  const normalized = userText.toLowerCase().trim();

  // --- COMANDOS DIRECTOS (sin pasar por OpenAI) ---

  // Sincronizar correo bajo demanda
  if (normalized === "sync" || normalized === "sincronizar" || normalized === "sincronizar correo" || normalized === "revisar correo") {
    try {
      await sendMessage(opts.chatId, "⏳ Sincronizando correo...");
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const res = await fetch(`${appUrl}/api/mail/sync`, { method: "POST" });
      const result = await res.json() as { ok: boolean; message: string };
      await sendMessage(opts.chatId, result.ok ? `✅ ${result.message}` : `❌ ${result.message}`);
    } catch (e) {
      await sendMessage(opts.chatId, "❌ Error al sincronizar correo.");
    }
    return;
  }

  // Sincronizar hoja del turno bajo demanda
  if (normalized === "sync hoja" || normalized === "sincronizar hoja" || normalized === "revisar hoja") {
    try {
      await sendMessage(opts.chatId, "⏳ Sincronizando hoja del turno...");
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const res = await fetch(`${appUrl}/api/sheets/sync`, { method: "POST" });
      const result = await res.json() as { ok: boolean; message: string };
      await sendMessage(opts.chatId, result.ok ? `✅ ${result.message}` : `❌ ${result.message}`);
    } catch (e) {
      await sendMessage(opts.chatId, "❌ Error al sincronizar la hoja.");
    }
    return;
  }

  // Lista de comandos
  if (normalized === "ayuda" || normalized === "help" || normalized === "comandos") {
    await sendMessage(opts.chatId,
      `<b>📋 Comandos del Copiloto</b>\n\n` +
      `• <b>sincronizar</b> — revisar correo nuevo\n` +
      `• <b>sync hoja</b> — revisar la hoja del turno\n` +
      `• <b>camas disponibles</b> — capacidad actual\n` +
      `• <b>correos pendientes</b> — sin responder\n` +
      `• <b>correos importantes</b> — de contactos prioritarios\n` +
      `• <b>resumen del turno</b> — estado general\n` +
      `• <b>ayuda</b> — esta lista\n\n` +
      `También puedes hacer cualquier pregunta en lenguaje natural.`
    );
    return;
  }

    // ─── FALLBACK: LLM conversacional (sin tools, sin function-calling) ───
    try {
      const systemContext = await getSystemContextForAI();
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Eres el Agente Ejecutivo del Copiloto de Camas. Tono ejecutivo, claro, resolutivo. No inventas datos. No tomas decisiones clínicas.\n\nContexto actual:\n${systemContext}`
          },
          { role: "user", content: userText }
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