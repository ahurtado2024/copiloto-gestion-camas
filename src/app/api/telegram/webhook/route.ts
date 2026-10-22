/* ------------------------------------------------------------------ */
/*  WEBHOOK DE TELEGRAM                                                */
/*  Procesa mensajes de texto y callbacks de botones inline.           */
/* ------------------------------------------------------------------ */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendMessage } from "@/lib/telegram";
import { processIncomingMessage } from "@/lib/assistant";
import { proposeDischarge } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const update = await req.json();

    // ─── Mensaje de texto o voz ──────────────────────────────────────
    if (update.message) {
      const chatId = update.message.chat.id.toString();
      const text = update.message.text as string | undefined;
      const voice = update.message.voice as { file_id: string } | undefined;

      if (!text && !voice) return NextResponse.json({ ok: true });

      await processIncomingMessage({
        chatId,
        text,
        voiceId: voice?.file_id,
        fromName: update.message.from?.first_name || "Usuario",
      });
    }

    // ─── Callback de botón inline (ej: "🗑 Descartar") ───────────────
    if (update.callback_query) {
      const callbackId = update.callback_query.id;
      const chatId = update.callback_query.message?.chat?.id?.toString() ?? "";
      const data = update.callback_query.data as string;

      const discardMatch = data.match(/^discard_(\d+)$/);
      if (discardMatch && chatId) {
        const msgId = parseInt(discardMatch[1], 10);
        try {
          await db.update(messages)
            .set({ status: "no_aplica" })
            .where(eq(messages.id, msgId));
          await sendMessage(chatId, `🗑 Correo #${msgId} descartado.`);
        } catch {
          await sendMessage(chatId, `❌ No se pudo descartar el correo #${msgId}.`);
        }
      }

      // ─── Callback: Proponer Alta (Desde comando Camas Estancadas) ───
      const proposeMatch = data.match(/^propose_discharge_(\d+)$/);
      if (proposeMatch && chatId) {
        const bedId = parseInt(proposeMatch[1], 10);
        try {
          const result = await proposeDischarge({ bedId, origin: "telegram" });
          if (result.ok) {
            await sendMessage(chatId, `✅ <b>Propuesta de alta creada.</b>\nEnviada al grupo de turno para confirmación formal.`);
          } else {
            await sendMessage(chatId, `❌ No se pudo crear la propuesta: ${result.message}`);
          }
        } catch (e) {
          await sendMessage(chatId, "❌ Error del sistema al proponer el alta.");
        }
      }

      // ─── Callback: Redactar Borrador (Desde correos pendientes) ───
      const draftMatch = data.match(/^draft_reply_(\d+)$/);
      if (draftMatch && chatId) {
        const msgId = parseInt(draftMatch[1], 10);
        try {
          const { draftReply } = await import("@/lib/engine");
          const result = await draftReply({ messageId: msgId, actor: "Telegram (Usuario)" });
          
          if (result.ok) {
            await sendMessage(chatId, `✍️ <b>Borrador Listo</b>\n\nHe generado una propuesta de respuesta en el Copiloto.\nRevisa el panel de Aprobaciones para editar o enviar.`);
          } else {
            await sendMessage(chatId, `❌ ${result.message}`);
          }
        } catch (e) {
          await sendMessage(chatId, "❌ Error al generar el borrador.");
        }
      }

      // Responder al callback para que Telegram quite el spinner
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackId }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("ERROR WEBHOOK TELEGRAM:", error);
    return NextResponse.json({ ok: true }); // Siempre OK a Telegram
  }
}

