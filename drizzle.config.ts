import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Carga .env.local primero, luego .env
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

/**
 * Runtime y migraciones NO deberían usar la misma URL en Supabase:
 * - DATABASE_URL  → runtime app (pooler transaction mode, 6543)
 * - DIRECT_URL    → drizzle push / migraciones (direct connection, 5432)
 *
 * Si DIRECT_URL no existe, usamos DATABASE_URL como fallback para dev local.
 */
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "Ni DIRECT_URL ni DATABASE_URL están definidas.\n" +
      "Copia .env.example a .env.local y agrega al menos DATABASE_URL.\n" +
      "En Supabase: usa DIRECT_URL para migraciones y DATABASE_URL para runtime."
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
