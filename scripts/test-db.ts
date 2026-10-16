import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
import { Pool } from "pg";

function maskUrl(url: string) {
  return url.replace(/:(.*?)@/, ":****@");
}

async function test(label: string, raw?: string) {
  if (!raw) {
    console.log(`\n[${label}] ✗ no definida`);
    return;
  }

  let url = raw;
  const isSupabase = url.includes("supabase.co") || url.includes("pooler.supabase.com");
  if (isSupabase && !url.includes("sslmode=")) {
    url = url.includes("?") ? `${url}&sslmode=require` : `${url}?sslmode=require`;
  }

  console.log(`\n[${label}] probando conexion...`);
  console.log(`[${label}] URL: ${maskUrl(url)}`);

  const pool = new Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 10000,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const start = Date.now();
    const result = await pool.query("SELECT current_database() AS db, current_user AS usr");
    const ms = Date.now() - start;
    console.log(`[${label}] ✓ conexion OK en ${ms}ms`);
    console.log(`[${label}] db=${result.rows[0].db} user=${result.rows[0].usr}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`[${label}] ✗ error: ${msg}`);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function main() {
  console.log("=== Supabase connectivity doctor ===");
  await test("DATABASE_URL", process.env.DATABASE_URL);
  await test("DIRECT_URL", process.env.DIRECT_URL);
}

main().catch((e) => { console.error(e); process.exit(1); });