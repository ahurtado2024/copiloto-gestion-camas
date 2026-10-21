/* ------------------------------------------------------------------ */
/*  MÓDULO DE CORREO UNIVERSAL (IMAP)                                  */
/*  Flexible para Gmail, Outlook, corporativo, etc.                    */
/*                                                                     */
/*  Estrategia:                                                        */
/*  - lee desde IMAP                                                   */
/*  - toma una ventana temporal configurable (por defecto 90 días)     */
/*  - procesa los 50 correos MÁS RECIENTES de esa ventana              */
/*  - la deduplicación la hace la BD con externalId (R7)               */
/* ------------------------------------------------------------------ */

import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";

function getMailConfig() {
  const host = process.env.MAIL_IMAP_HOST;
  const port = process.env.MAIL_IMAP_PORT ? parseInt(process.env.MAIL_IMAP_PORT, 10) : 993;
  const user = process.env.MAIL_IMAP_USER;
  const pass = process.env.MAIL_IMAP_PASS;
  const secure = process.env.MAIL_IMAP_SECURE === "true";

  return {
    host,
    port,
    auth: { user, pass },
    secure,
    isConfigured: !!(host && user && pass),
  };
}

export type InboundEmail = {
  externalId: string;
  fromName: string;
  fromAddress: string;
  smtpMessageId: string;
  subject: string;
  body: string;
  receivedAt: Date;
};

function mapParsedMail(uid: number, parsed: ParsedMail): InboundEmail {
  return {
    externalId: uid.toString(),
    fromName: parsed.from?.value?.[0]?.name || parsed.from?.text || "Desconocido",
    fromAddress: parsed.from?.value?.[0]?.address || "",
    smtpMessageId: parsed.messageId || "",
    subject: parsed.subject || "(Sin asunto)",
    body: parsed.text || parsed.html?.toString() || "",
    receivedAt: parsed.date || new Date(),
  };
}

export async function fetchInbox(): Promise<{ ok: boolean; emails: InboundEmail[]; error?: string }> {
  const config = getMailConfig();
  const emails: InboundEmail[] = [];

  if (!config.isConfigured) {
    return { ok: false, emails: [], error: "Configuración de correo incompleta en .env.local" };
  }

  const client = new ImapFlow({
    host: config.host!,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.auth.user!,
      pass: config.auth.pass!,
    },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const { getRules } = await import("./config");
      const rules = await getRules();

      const lookbackDays = rules.MAIL_LOOKBACK_DAYS;
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - lookbackDays);

      const searchCriteria = { since: sinceDate };
      const searchResult = await client.search(searchCriteria);
      const allUids: number[] = Array.isArray(searchResult) ? searchResult : [];

      if (allUids.length === 0) {
        return { ok: true, emails };
      }

      const MAX_EMAILS_PER_SYNC = 50;
      const recentUids = allUids.slice(-MAX_EMAILS_PER_SYNC);
      const orderedRecentUids = [...recentUids].reverse();

      for await (const message of client.fetch(orderedRecentUids, { source: true, envelope: true })) {
        if (!message.source) continue;
        const parsed = await simpleParser(message.source as Buffer);
        emails.push(mapParsedMail(message.uid, parsed));
      }
    } finally {
      lock.release();
    }

    await client.logout();
    return { ok: true, emails };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error IMAP desconocido";
    console.error("MAIL ERROR:", error);
    return { ok: false, emails: [], error: msg };
  }
}



