import { db } from "@/db";
import { beds, events, settings } from "@/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, boolean> = {};
  const start = Date.now();

  try {
    // 1. Conectividad a PostgreSQL
    await db.execute(sql`SELECT 1`);
    checks.database = true;
  } catch {
    checks.database = false;
  }

  try {
    // 2. Tablas existen y tienen datos
    const [bedCount] = await db.select({ n: sql<number>`count(*)::int` }).from(beds);
    checks.schema = (bedCount?.n ?? 0) > 0;
  } catch {
    checks.schema = false;
  }

  try {
    // 3. Configuración cargable
    const rows = await db.select().from(settings);
    checks.config = rows.length > 0;
  } catch {
    checks.config = false;
  }

  try {
    // 4. Caja negra escribible (no insertamos de verdad, solo verificamos la tabla)
    const [evCount] = await db.select({ n: sql<number>`count(*)::int` }).from(events);
    checks.audit_log = (evCount?.n ?? 0) >= 0;
  } catch {
    checks.audit_log = false;
  }

  const allOk = Object.values(checks).every(Boolean);
  const latencyMs = Date.now() - start;

  return Response.json(
    {
      ok: allOk,
      checks,
      latencyMs,
      version: "1.0.0-beta",
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  );
}
