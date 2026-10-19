/* ------------------------------------------------------------------ */
/*  POST /api/sheets/sync                                              */
/*  Lee la hoja del turno y compara con el registro en paralelo.      */
/*  Si hay diferencias → abre conflictos para que el humano resuelva. */
/*  NUNCA sobreescribe la BD sin autorización humana (R1/R3).         */
/* ------------------------------------------------------------------ */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { beds } from "@/db/schema";
import { readSheet, diffSheetVsDb } from "@/lib/sheets";
import { openConflict, logEvent } from "@/lib/engine";

export const dynamic = "force-dynamic";

function isRealMode(): boolean {
  return !!(
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SHEETS_PRIVATE_KEY &&
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  );
}

export async function POST() {
  const now = new Date();
  const realMode = isRealMode();

  try {
    const sheetResult = await readSheet();
    if (!sheetResult.ok) {
      return NextResponse.json({
        ok: false,
        message: `No se pudo leer la hoja: ${sheetResult.error ?? "error desconocido"}`,
        tone: "error",
      });
    }

    const dbBeds = await db.select({ code: beds.code, status: beds.status }).from(beds);
    const diffs = diffSheetVsDb(sheetResult.rows, dbBeds);
    const conflicts = diffs.filter((d) => d.hasConflict);
    const matches = diffs.filter((d) => !d.hasConflict);

    let conflictsOpened = 0;
    for (const diff of conflicts) {
      const fullBed = (await db.select().from(beds)).find((b) => b.code === diff.code);
      if (!fullBed) continue;

      const result = await openConflict({
        bedId: fullBed.id,
        sourceA: "registro paralelo (Supabase)",
        valueA: diff.dbStatus,
        sourceB: "hoja del turno (Sheets)",
        valueB: diff.sheetRaw,
      });

      if (result.ok || result.tone === "warn") {
        conflictsOpened++;
      }
    }

    await logEvent({
      actor: "sistema",
      source: "hoja",
      kind: "dato_reconfirmado",
      summary:
        `Sincronización con la hoja del turno: ` +
        `${sheetResult.rows.length} filas leídas, ` +
        `${matches.length} coincidencias, ` +
        `${conflictsOpened} conflictos abiertos. ` +
        (realMode ? `[Spreadsheet: ${sheetResult.spreadsheetId}]` : "[MODO DEMO — hoja simulada]"),
      payload: {
        readAt: sheetResult.readAt.toISOString(),
        rows: sheetResult.rows.length,
        matches: matches.length,
        conflictsOpened,
        realMode,
      },
    });

    return NextResponse.json({
      ok: true,
      message:
        conflictsOpened > 0
          ? `Sync completado: ${conflictsOpened} diferencia${conflictsOpened > 1 ? "s" : ""} entre la hoja y el registro → conflictos abiertos para que los resuelvas tú.`
          : `Sync completado: ${sheetResult.rows.length} filas leídas, todo coincide con el registro.`,
      tone: conflictsOpened > 0 ? "warn" : "ok",
      data: {
        readAt: sheetResult.readAt.toISOString(),
        rows: sheetResult.rows.length,
        matches: matches.length,
        conflictsOpened,
        realMode,
      },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: `Error en sincronización: ${error instanceof Error ? error.message : "error desconocido"}`,
      tone: "error",
    });
  }
}

export async function GET() {
  const realMode = isRealMode();
  const sheetResult = await readSheet();
  return NextResponse.json({
    ok: sheetResult.ok,
    realMode,
    lastRead: sheetResult.readAt.toISOString(),
    rowsAvailable: sheetResult.rows.length,
    integration: realMode ? "real" : "simulada",
    spreadsheetId: sheetResult.spreadsheetId ?? null,
    sheetName: sheetResult.sheetName ?? null,
    error: sheetResult.error ?? null,
  });
}
