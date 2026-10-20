/* ------------------------------------------------------------------ */
/*  WEBHOOK DE TELEGRAM                                                */
/*  Escucha mensajes, audios y comandos del usuario.                   */
/* ------------------------------------------------------------------ */

import { NextResponse } from "next/server";
import { sendMessage } from "@/lib/telegram";
import { processIncomingMessage } from "@/lib/assistant";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const update = await req.json();

    // Filtramos solo mensajes de texto o voz
    if (update.message) {
      const chatId = update.message.chat.id.toString();
      const text = update.message.text;
      const voice = update.message.voice;

      // Ignorar si no es algo que podamos procesar
      if (!text && !voice) return NextResponse.json({ ok: true });

      // Ejecutar lógica del asistente (Inteligencia Artificial)
      // Pasamos el mensaje al cerebro para que decida qué responder
      await processIncomingMessage({
        chatId,
        text,
        voiceId: voice?.file_id,
        fromName: update.message.from?.first_name || "Usuario",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("ERROR WEBHOOK TELEGRAM:", error);
    return NextResponse.json({ ok: true }); // Siempre responder OK a Telegram
  }
}

