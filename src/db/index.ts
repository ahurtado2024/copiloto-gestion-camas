import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const isSupabase =
  databaseUrl.includes("supabase.co") ||
  databaseUrl.includes("pooler.supabase.com");

/**
 * Configuración para Supabase + Vercel (serverless) y desarrollo local.
 *
 * PROBLEMA RESUELTO:
 * - sslmode=no-verify en la URL es ignorado por el driver `pg` en algunos contextos.
 * - La solución correcta es pasar ssl como objeto de configuración directamente al Pool.
 * - rejectUnauthorized: false equivale a sslmode=no-verify (cifrado activo, sin verificar CA).
 * - max: 2 permite manejar múltiples queries concurrentes del tablero sin agotar el pool.
 * - idleTimeoutMillis: 10000 cierra conexiones inactivas rápido (importante en serverless).
 */
const globalForDb = globalThis as typeof globalThis & {
  __pool?: Pool;
};

if (!globalForDb.__pool) {
  globalForDb.__pool = new Pool({
    connectionString: databaseUrl,
    max: isSupabase ? 2 : 10,
    idleTimeoutMillis: isSupabase ? 10000 : 30000,
    connectionTimeoutMillis: 15000,
    // SSL como objeto: evita la discrepancia con sslmode en la URL
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  });
}

export const pool = globalForDb.__pool;
export const db = drizzle(pool);
