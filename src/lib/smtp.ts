/* ------------------------------------------------------------------ */
/*  MÓDULO SMTP — Envío de correos reales con soporte de threading     */
/*  Los headers In-Reply-To y References permiten que Gmail, Outlook   */
/*  y otros clientes agrupen la respuesta bajo el mismo hilo.          */
/* ------------------------------------------------------------------ */

import nodemailer from "nodemailer";

function getSmtpConfig() {
  return {
    host: process.env.MAIL_SMTP_HOST,
    port: parseInt(process.env.MAIL_SMTP_PORT || "587", 10),
    secure: process.env.MAIL_SMTP_SECURE === "true",
    auth: {
      user: process.env.MAIL_SMTP_USER,
      pass: process.env.MAIL_SMTP_PASS,
    },
    from: process.env.MAIL_SMTP_FROM || "Copiloto Camas <sistema@copiloto.cl>",
  };
}

export async function sendRealEmail(opts: {
  to: string;
  subject: string;
  body: string;
  html?: string;
  /** Message-ID del correo original — para threading de hilos */
  inReplyToMessageId?: string;
  previousReferences?: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const config = getSmtpConfig();

  if (!config.auth.user || !config.auth.pass || !config.host) {
    return { ok: false, error: "Configuración SMTP incompleta" };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  try {
    // Construir headers de threading
    const headers: Record<string, string> = {};
    if (opts.inReplyToMessageId) {
      // Estos dos headers son los que Gmail/Outlook usan para agrupar en hilos
      headers["In-Reply-To"] = opts.inReplyToMessageId;
      headers["References"] = opts.inReplyToMessageId;
    }

    const info = await transporter.sendMail({
      from: config.from,
      to: opts.to,
      subject: opts.subject,
      text: opts.body,
      html: opts.html || opts.body.replace(/\n/g, "<br/>"),
      headers,
    });

    return { ok: true, messageId: info.messageId };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error SMTP desconocido";
    console.error("SMTP ERROR:", error);
    return { ok: false, error: msg };
  }
}


