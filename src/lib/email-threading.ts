/* ------------------------------------------------------------------ */
/*  EMAIL THREADING — Resolución y mantenimiento de hilos              */
/*                                                                     */
/*  Estrategia en 3 capas (de más fuerte a más débil):                 */
/*  1. Match por headers SMTP (In-Reply-To + References)  — exacto     */
/*  2. Fallback por asunto normalizado + remitente         — heurístico */
/*  3. Nuevo hilo                                          — cuando nada coincide */
/* ------------------------------------------------------------------ */

import { db } from "@/db";
import { messages } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

/* ---- Normalización de asunto ---- */

const SUBJECT_PREFIXES = /^((re|fw|fwd|rv|enc|aw)\s*:\s*)+/i;

export function normalizeSubject(subject: string): string {
  return subject.replace(SUBJECT_PREFIXES, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/* ---- Parseo de cadena de Message-IDs ---- */

export function parseMessageIds(raw?: string | null): string[] {
  if (!raw) return [];
  const bracketted = raw.match(/<[^>]+>/g);
  if (bracketted?.length) return bracketted.map((s) => s.trim());
  return raw.split(/\s+/).map((s) => s.trim()).filter(Boolean);
}

/* ---- Construcción de cadena References para el envío ---- */

export function buildReferences(params: {
  previousReferences?: string | null;
  previousMessageId?: string | null;
}): string {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const id of parseMessageIds(params.previousReferences)) {
    if (!seen.has(id)) { seen.add(id); parts.push(id); }
  }
  if (params.previousMessageId) {
    const id = params.previousMessageId.trim();
    if (!seen.has(id)) { seen.add(id); parts.push(id); }
  }

  return parts.join(" ");
}

/* ---- Resolución del hilo al recibir un correo entrante ---- */

export type ThreadResolution = {
  parentMessageId: number | null;
  threadKey: string;
  subjectKey: string;
};

export async function resolveThread(opts: {
  fromAddress: string;
  subject: string;
  smtpMessageId: string;
  smtpInReplyTo?: string | null;
  smtpReferences?: string | null;
}): Promise<ThreadResolution> {
  const subjectKey = normalizeSubject(opts.subject);

  // --- Capa 1: buscar por cualquier Message-ID del hilo SMTP ---
  const candidates = Array.from(
    new Set([
      ...parseMessageIds(opts.smtpInReplyTo),
      ...parseMessageIds(opts.smtpReferences),
    ])
  );

  for (const messageId of candidates) {
    if (!messageId) continue;
    const [found] = await db
      .select({ id: messages.id, threadKey: messages.threadKey })
      .from(messages)
      .where(eq(messages.smtpMessageId, messageId))
      .limit(1);

    if (found?.threadKey) {
      return {
        parentMessageId: found.id,
        threadKey: found.threadKey,
        subjectKey,
      };
    }
  }

  // --- Capa 2: fallback por remitente + asunto normalizado (ventana 30 días) ---
  const since30 = new Date(Date.now() - 30 * 24 * 3600_000);
  const [recent] = await db
    .select({ id: messages.id, threadKey: messages.threadKey, receivedAt: messages.receivedAt })
    .from(messages)
    .where(
      and(
        eq(messages.channel, "correo"),
        eq(messages.subjectKey, subjectKey),
        eq(messages.fromAddress, opts.fromAddress)
      )
    )
    .orderBy(desc(messages.receivedAt))
    .limit(1);

  if (recent?.threadKey && recent.receivedAt >= since30) {
    return {
      parentMessageId: recent.id,
      threadKey: recent.threadKey,
      subjectKey,
    };
  }

  // --- Capa 3: nuevo hilo ---
  return {
    parentMessageId: null,
    threadKey: opts.smtpMessageId || `mail:${Date.now()}`,
    subjectKey,
  };
}
