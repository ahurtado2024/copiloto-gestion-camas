import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/env";

const databaseUrl = env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

/**
 * Supabase + Vercel (serverless):
 * - Runtime debe usar pooler transaction mode (6543) cuando esté en Supabase.
 * - max: 1 por instancia caliente; el pooler multiplica conexiones.
 * - SSL requerido en entornos remotos.
 * - Cliente a nivel de módulo para reuso entre invocaciones.
 */
const isRemoteSupabase = databaseUrl.includes("supabase.co") || databaseUrl.includes("pooler.supabase.com");

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    max: isRemoteSupabase ? 1 : 10,
    idleTimeoutMillis: isRemoteSupabase ? 0 : 30000,
    connectionTimeoutMillis: 10000,
    ssl: isRemoteSupabase ? { rejectUnauthorized: false } : undefined,
    allowExitOnIdle: true,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
