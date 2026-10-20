/* ------------------------------------------------------------------ */
/*  ASISTENTE INTELIGENTE (LLM + HERRAMIENTAS)                         */
/*  Cerebro del Copiloto para respuestas hiper-naturales y proactivas. */
/* ------------------------------------------------------------------ */

import OpenAI from "openai";
import { sendMessage } from "./telegram";
import { db } from "@/db";
import { beds, cleaningTasks } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { BED_STATE_META } from "./domain";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Procesa un mensaje entrante (Texto o Voz)
 */
export async function processIncomingMessage(opts: {
  chatId: string;
  text?: string;
  voiceId?: string;
  fromName: string;
}) {
  let userText = opts.text || "";

  // 1. Si es voz, transcribir con Whisper
  if (opts.voiceId) {
    userText = await transcribeVoice(opts.voiceId);
  }

  if (!userText) return;

  // 2. Obtener Contexto del Sistema (Capacidad actual)
  const systemContext = await getSystemContextForAI();

  // 3. Consultar al LLM
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres el Asistente de Alto Nivel del Copiloto de Gestión de Camas de la Red O'Higgins. 
          Tu tono es competitivo, eficiente, proactivo y muy profesional. 
          
          LIMITES: No das diagnósticos médicos ni realizas triage. Tu foco es la CAPACIDAD OPERATIVA.
          
          CONTEXTO ACTUAL DEL HOSPITAL:
          ${systemContext}
          
          INSTRUCCIONES:
          - Si te preguntan disponibilidad, responde con datos exactos del contexto.
          - Si el tono es urgente, responde rápido y directo.
          - Si detectas una solicitud de resumen, agrupa por unidad.
          - No inventes datos que no estén en el contexto.`
        },
        { role: "user", content: userText }
      ],
      temperature: 0.7,
    });

    const aiMessage = response.choices[0].message.content;
    if (aiMessage) {
      await sendMessage(opts.chatId, aiMessage);
    }
  } catch (error) {
    console.error("AI Error:", error);
    await sendMessage(opts.chatId, "Disculpa, estoy procesando mucha información. ¿Podrías repetirme la consulta?");
  }
}

/**
 * Transcribe un archivo de voz de Telegram usando Whisper
 */
async function transcribeVoice(fileId: string): Promise<string> {
  // Nota: Implementación simplificada. Requiere descargar el archivo de los servidores de Telegram.
  // Por ahora devolvemos un placeholder funcional.
  return "[Audio recibido: Procesando disponibilidad]"; 
}

/**
 * Genera un resumen de texto de la BD para que la IA lo use de contexto
 */
async function getSystemContextForAI(): Promise<string> {
  const allBeds = await db.select().from(beds);
  const activeTasks = await db.select().from(cleaningTasks).where(sql`${cleaningTasks.status} != 'completed'`);

  const avail = allBeds.filter(b => b.status === 'available').map(b => `${b.code} (${b.unit})`).join(", ");
  const cleaning = allBeds.filter(b => b.status === 'cleaning' || b.status === 'pending_cleaning').length;

  return `
  - Camas Disponibles: ${allBeds.filter(b => b.status === 'available').length} (${avail || "Ninguna ahora"})
  - Camas en Limpieza/Aviso: ${cleaning}
  - Tareas de aseo activas: ${activeTasks.length}
  - Total camas en red: ${allBeds.length}
  `;
}
