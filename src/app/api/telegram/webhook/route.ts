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

