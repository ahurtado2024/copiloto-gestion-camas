/* ------------------------------------------------------------------ */
/*  MÓDULO SMTP — Envío de correos reales                              */
/* ------------------------------------------------------------------ */

import nodemailer from "nodemailer";

/**
 * Configuración del transportador leída de process.env
 */
function getSmtpConfig() {
  return {
    host: process.env.MAIL_SMTP_HOST,
    port: parseInt(process.env.MAIL_SMTP_PORT || "587", 10),
    secure: process.env.MAIL_SMTP_SECURE === "true", // true para 465, false para otros
    auth: {
      user: process.env.MAIL_SMTP_USER,
      pass: process.env.MAIL_SMTP_PASS,
    },
    from: process.env.MAIL_SMTP_FROM || "Copiloto Camas <sistema@copiloto.cl>",
  };
}

/**
 * Envía un correo electrónico real.
 * Retorna true si se envió con éxito.
 */
export async function sendRealEmail(opts: {
  to: string;
  subject: string;
  body: string;
  html?: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const config = getSmtpConfig();

  if (!config.auth.user || !config.auth.pass || !config.host) {
    return { ok: false, error: "Configuración SMTP incompleta en .env" };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  try {
    const info = await transporter.sendMail({
      from: config.from,
      to: opts.to,
      subject: opts.subject,
      text: opts.body,
      html: opts.html || opts.body.replace(/\n/g, "<br/>"),
    });

    console.log("SMTP: Correo enviado con éxito:", info.messageId);
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error SMTP desconocido";
    console.error("SMTP ERROR:", error);
    return { ok: false, error: msg };
  }
}

/**
 * Verifica si la conexión con el servidor de correo funciona
 */
export async function verifySmtpConnection() {
  const config = getSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  try {
    await transporter.verify();
    return { ok: true, message: "Conexión SMTP exitosa" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Fallo conexión SMTP";
    return { ok: false, message: msg };
  }
}
