/* ------------------------------------------------------------------ */
/*  MÓDULO DE TELEGRAM BOT                                             */
/*  Notificaciones proactivas para Turno y Aseo                        */
/* ------------------------------------------------------------------ */

function getTelegramConfig() {
    return {
      token: process.env.TELEGRAM_BOT_TOKEN,
      chatTurno: process.env.TELEGRAM_CHAT_ID_TURNO,
      chatAseo: process.env.TELEGRAM_CHAT_ID_ASEO,
      appUrl:
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : "http://localhost:3000"),
    };
  }
  
  export type TelegramResult = {
    ok: boolean;
    transportOk: boolean;
    telegramOk: boolean;
    message?: string;
    status?: number;
    response?: unknown;
  };
  
  const TELEGRAM_TIMEOUT_MS = 10000;
  
  /**
   * Envía un mensaje simple a un chat.
   * Retorna resultado estructurado para que el motor pueda auditar éxito/fallo.
   */
  export async function sendMessage(
    chatId: string,
    text: string,
    options: Record<string, unknown> = {}
  ): Promise<TelegramResult> {
    const { token } = getTelegramConfig();
    if (!token || !chatId) {
      return {
        ok: false,
        transportOk: false,
        telegramOk: false,
        message: "Telegram no configurado: falta token o chatId.",
      };
    }
  
    const API_BASE = `https://api.telegram.org/bot${token}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
  
    try {
      const res = await fetch(`${API_BASE}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          ...options,
        }),
        signal: controller.signal,
      });
  
      const payload = (await res.json()) as { ok?: boolean; description?: string };
      clearTimeout(timeout);
  
      return {
        ok: res.ok && payload.ok === true,
        transportOk: res.ok,
        telegramOk: payload.ok === true,
        status: res.status,
        message: payload.description ?? (res.ok ? "Mensaje enviado" : "Error en Telegram API"),
        response: payload,
      };
    } catch (error) {
      clearTimeout(timeout);
      const msg = error instanceof Error ? error.message : "Error desconocido";
      return {
        ok: false,
        transportOk: false,
        telegramOk: false,
        message: msg,
      };
    }
  }
  
  /** Notifica una nueva propuesta de alta al grupo de Turno */
  export async function notifyNewProposal(data: {
    bedCode: string;
    unit: string;
    source: string;
    approvalCode: string;
  }) {
    const { chatTurno, appUrl } = getTelegramConfig();
    const text =
      `<b>🔔 NUEVA PROPUESTA DE ALTA</b>\n\n` +
      `Cama: <b>${data.bedCode}</b>\n` +
      `Unidad: ${data.unit}\n` +
      `Fuente: ${data.source}\n` +
      `Código: <code>${data.approvalCode}</code>\n\n` +
      `¿Confirmas el alta para avisar a limpieza?`;
  
    return sendMessage(chatTurno || "", text, {
      reply_markup: {
        inline_keyboard: [[{ text: "📂 Ver en Copiloto", url: `${appUrl}/aprobaciones` }]],
      },
    });
  }
  
  /** Notifica al grupo de Aseo una nueva tarea de limpieza */
  export async function notifyAseoNewTask(data: {
    bedCode: string;
    unit: string;
    taskCode: string;
  }) {
    const { chatAseo } = getTelegramConfig();
    const text =
      `<b>🧹 NUEVA TAREA DE LIMPIEZA</b>\n\n` +
      `Cama: <b>${data.bedCode}</b>\n` +
      `Unidad: ${data.unit}\n` +
      `Código: <code>${data.taskCode}</code>\n\n` +
      `Favor informar inicio y término por los canales habituales.`;
  
    return sendMessage(chatAseo || "", text);
  }
  
