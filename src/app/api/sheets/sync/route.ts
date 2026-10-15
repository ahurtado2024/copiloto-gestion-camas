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
import { IS_DEMO } from "@/env";

export const dynamic = "force-dynamic";

export async function POST() {
  const now = new Date();

  try {
    // 1. Leer la hoja (real o simulada según configuración)
    const sheetResult = await readSheet();
    if (!sheetResult.ok) {
      return NextResponse.json({
        ok: false,
        message: `No se pudo leer la hoja: ${sheetResult.error ?? "error desconocido"}`,
        tone: "error",
      });
    }

    // 2. Leer el estado actual del registro
    const dbBeds = await db.select({ code: beds.code, status: beds.status }).from(beds);

    // 3. Calcular diferencias
    const diffs = diffSheetVsDb(sheetResult.rows, dbBeds);
    const conflicts = diffs.filter((d) => d.hasConflict);
    const matches = diffs.filter((d) => !d.hasConflict);

    // 4. Para cada diferencia → abrir conflicto (R3, no sobreescribir en silencio)
    let conflictsOpened = 0;
    for (const diff of conflicts) {
      const bed = dbBeds.find((b) => b.code === diff.code);
      if (!bed) continue;
      const bedRow = await db.select().from(beds).limit(1);
      if (!bedRow[0]) continue;

      // Buscar el bed completo para obtener el ID
      const fullBed = (await db.select().from(beds)).find((b) => b.code === diff.code);
      if (!fullBed) continue;

      const result = await openConflict({
        bedId: fullBed.id,
        sourceA: "registro paralelo (Supabase)",
        valueA: diff.dbStatus,
        sourceB: `hoja del turno (Sheets)`,
        valueB: diff.sheetRaw,
      });

      if (result.ok || result.tone === "warn") {
        conflictsOpened++;
      }
    }

    // 5. Registrar la sincronización en la caja negra
    await logEvent({
      actor: "sistema",
      source: "hoja",
      kind: IS_DEMO ? "dato_reconfirmado" : "dato_reconfirmado",
      summary:
        `Sincronización con la hoja del turno: ` +
        `${sheetResult.rows.length} filas leídas, ` +
        `${matches.length} coincidencias, ` +
        `${conflictsOpened} conflictos abiertos. ` +
        (IS_DEMO ? "[MODO DEMO — hoja simulada]" : `[Spreadsheet: ${sheetResult.spreadsheetId}]`),
      payload: {
        readAt: sheetResult.readAt.toISOString(),
        rows: sheetResult.rows.length,
        matches: matches.length,
        conflictsOpened,
        isDemo: IS_DEMO,
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
        isDemo: IS_DEMO,
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
  // Vista de estado de la integración
  const sheetResult = await readSheet();
  return NextResponse.json({
    ok: sheetResult.ok,
    isDemo: IS_DEMO,
    lastRead: sheetResult.readAt.toISOString(),
    rowsAvailable: sheetResult.rows.length,
    integration: IS_DEMO ? "simulada" : "real",
    spreadsheetId: sheetResult.spreadsheetId ?? null,
    sheetName: sheetResult.sheetName ?? null,
    error: sheetResult.error ?? null,
  });
}
