/* ------------------------------------------------------------------ */
/*  VALIDACIÓN DE VARIABLES DE ENTORNO                                 */
/*  Se ejecuta en el arranque del servidor.                            */
/*  Si falta una variable crítica, el servidor no arranca y dice       */
/*  exactamente qué falta — no hay errores crípticos en producción.    */
/* ------------------------------------------------------------------ */

import { z } from "zod";

const server = z.object({
  // Requerida siempre para runtime
  DATABASE_URL: z.string().url("DATABASE_URL debe ser una URL válida de PostgreSQL"),
  // Opcional pero recomendada en Supabase para migraciones / drizzle push
  DIRECT_URL: z.string().url("DIRECT_URL debe ser una URL válida de PostgreSQL").optional(),

  // Entorno — controla flags de feature
  APP_ENV: z
    .enum(["demo", "dev", "staging", "pilot"])
    .default("demo"),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Google Sheets — requerida solo en staging/pilot con integración activa
  GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
  GOOGLE_SHEETS_PRIVATE_KEY: z.string().optional(),
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().optional(),

  // Gmail — requerida solo en staging/pilot con integración activa
  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),
  GMAIL_REFRESH_TOKEN: z.string().optional(),

  // Telegram — requerida solo en staging/pilot con integración activa
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID_TURNO: z.string().optional(),
  TELEGRAM_CHAT_ID_ASEO: z.string().optional(),

  // Auth — requerida en staging/pilot
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().optional(),

  // Supabase SDK directo (alternativa / complemento a DATABASE_URL)
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

const client = z.object({
  // Solo vars NEXT_PUBLIC_ aquí
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
});

function validateEnv() {
  try {
    const serverParsed = server.safeParse(process.env);
    if (!serverParsed.success) {
      const issues = serverParsed.error.issues
        .map((i) => `  ✗ ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new Error(
        `\n⚠️  Variables de entorno inválidas o faltantes:\n${issues}\n\n` +
          `  Copia .env.example a .env.local y completa los valores.\n`
      );
    }
    return serverParsed.data;
  } catch (e) {
    if (e instanceof Error && e.message.includes("Variables de entorno")) {
      throw e;
    }
    // En entornos donde no se puede acceder a process.env (edge), se retorna vacío
    return {} as z.infer<typeof server>;
  }
}

export const env = validateEnv();

/** Flags de entorno útiles en el código */
export const IS_DEMO = env.APP_ENV === "demo";
export const IS_DEV = env.APP_ENV === "dev" || process.env.NODE_ENV === "development";
export const IS_STAGING = env.APP_ENV === "staging";
export const IS_PILOT = env.APP_ENV === "pilot";

/** Verifica si la integración de Sheets está configurada */
export const HAS_SHEETS =
  !!env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL &&
  !!env.GOOGLE_SHEETS_PRIVATE_KEY &&
  !!env.GOOGLE_SHEETS_SPREADSHEET_ID;

/** Verifica si la integración de Gmail está configurada */
export const HAS_GMAIL =
  !!env.GMAIL_CLIENT_ID && !!env.GMAIL_CLIENT_SECRET && !!env.GMAIL_REFRESH_TOKEN;

/** Verifica si la integración de Telegram está configurada */
export const HAS_TELEGRAM = !!env.TELEGRAM_BOT_TOKEN && !!env.TELEGRAM_CHAT_ID_TURNO;
