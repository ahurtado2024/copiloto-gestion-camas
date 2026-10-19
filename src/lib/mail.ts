/* ------------------------------------------------------------------ */
/*  MÓDULO DE CORREO UNIVERSAL (IMAP)                                  */
/*  Diseño flexible para conectar cualquier proveedor de correo.       */
/* ------------------------------------------------------------------ */

import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";

/** 
 * Configuración de conexión leída directamente de process.env 
 */
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
  subject: string;
  body: string;
  receivedAt: Date;
};

function mapParsedMailToInbound(uid: number, parsed: ParsedMail): InboundEmail {
  return {
    externalId: uid.toString(),
    fromName: parsed.from?.value?.[0]?.name || parsed.from?.text || "Desconocido",
    fromAddress: parsed.from?.value?.[0]?.address || "",
    subject: parsed.subject || "(Sin asunto)",
    body: parsed.text || parsed.html?.toString() || "",
    receivedAt: parsed.date || new Date(),
  };
}

/**
 * Conecta al servidor y descarga los correos no leídos dentro de una
 * ventana de tiempo configurable. Evita sobrecargar el sistema con
 * años de historial del inbox.
 */
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

      const searchCriteria = {
        unseen: true,
        since: sinceDate,
      } as const;

      let count = 0;
      const MAX_EMAILS_PER_SYNC = 50;

      for await (const message of client.fetch(searchCriteria, { source: true, envelope: true })) {
        if (count >= MAX_EMAILS_PER_SYNC) break;
        count++;

        // Hay proveedores/servidores que pueden devolver items sin source.
        // En ese caso, se ignora el correo en vez de romper toda la sync.
        if (!message.source) {
          continue;
        }

        const parsed = await simpleParser(message.source as Buffer);
        emails.push(mapParsedMailToInbound(message.uid, parsed));
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

