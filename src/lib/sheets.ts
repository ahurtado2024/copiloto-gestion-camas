/* ------------------------------------------------------------------ */
/*  MÓDULO DE INTEGRACIÓN REAL CON GOOGLE SHEETS                       */
/*                                                                     */
/*  IMPORTANTE: las variables GOOGLE_SHEETS_* se leen directamente     */
/*  de process.env en el momento de uso, NO del cache de env.ts.       */
/*  Esto es necesario porque Next.js puede no tenerlas disponibles     */
/*  en el momento en que env.ts se ejecuta por primera vez.            */
/* ------------------------------------------------------------------ */

import { google } from "googleapis";
import type { BedStatus } from "./domain";

/* ---- Lectura directa de variables (no cache) ---- */

function getSheetConfig() {
  const email = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  return {
    email,
    key,
    id,
    isConfigured: !!email && !!key && !!id,
  };
}

/* ---- Tipos ---- */

export type SheetBedRow = {
  code: string;
  unit: string;
  estCode: string;
  status: BedStatus | null;
  rawStatus: string;
  note: string;
  lastEditedBy: string;
  lastEditedAt: Date | null;
  rowIndex: number;
};

export type SheetReadResult = {
  ok: boolean;
  rows: SheetBedRow[];
  readAt: Date;
  error?: string;
  spreadsheetId?: string;
  sheetName?: string;
};

/* ---- Mapeo de estados humanos ---- */

const SHEET_STATUS_MAP: Record<string, BedStatus> = {
  "ocupada": "occupied",
  "ocupado": "occupied",
  "disponible": "available",
  "libre": "available",
  "limpieza": "cleaning",
  "en limpieza": "cleaning",
  "aseo": "cleaning",
  "alta": "discharge_detected",
  "alta detectada": "discharge_detected",
  "inspección": "pending_inspection",
  "inspeccion": "pending_inspection",
  "reservada": "reserved",
  "bloqueada": "blocked",
  "mantención": "out_of_service",
  "mantencion": "out_of_service",
  "desconocido": "unknown",
  "?": "unknown",
};

export function parseSheetStatus(raw: string): BedStatus | null {
  if (!raw) return null;
  return SHEET_STATUS_MAP[raw.toLowerCase().trim()] ?? null;
}

/* ---- Lectura REAL de Google Sheets ---- */

async function readSheetReal(): Promise<SheetReadResult> {
  const now = new Date();
  const config = getSheetConfig();

  if (!config.isConfigured) {
    return {
      ok: false,
      rows: [],
      readAt: now,
      error: "Variables GOOGLE_SHEETS_* no detectadas en process.env. Reinicia el servidor después de editar .env.local.",
    };
  }

  try {
    const privateKey = config.key!.replace(/\\n/g, "\n");

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.email,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.id,
      range: "A2:H200",
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return {
        ok: true,
        rows: [],
        readAt: now,
        spreadsheetId: config.id,
        sheetName: "Hoja real (vacía)",
      };
    }

    const mappedRows: SheetBedRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const code = String(row[0] || "").trim();
      if (!code) continue;

      const rawStatus = String(row[4] || "").trim();

      mappedRows.push({
        code,
        unit: String(row[1] || "").trim(),
        estCode: String(row[2] || "").trim(),
        rawStatus,
        status: parseSheetStatus(rawStatus),
        note: String(row[7] || "").trim(),
        lastEditedBy: String(row[6] || "").trim() || "Sin dato",
        lastEditedAt: null,
        rowIndex: i + 2,
      });
    }

    return {
      ok: true,
      rows: mappedRows,
      readAt: now,
      spreadsheetId: config.id,
      sheetName: "Hoja real",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return {
      ok: false,
      rows: [],
      readAt: now,
      error: `Google Sheets API: ${msg}`,
    };
  }
}

/* ---- Lectura simulada (fallback sin credenciales) ---- */

function readSheetMock(): SheetReadResult {
  return {
    ok: true,
    readAt: new Date(),
    spreadsheetId: "DEMO_SIMULADO",
    sheetName: "Demo",
    rows: [
      { code: "C-301", unit: "Medicina 3", estCode: "HRR", status: "occupied", rawStatus: "Ocupada", note: "", lastEditedBy: "Demo", lastEditedAt: null, rowIndex: 2 },
    ],
  };
}

/* ---- Punto de entrada ---- */

export async function readSheet(): Promise<SheetReadResult> {
  const config = getSheetConfig();
  if (!config.isConfigured) {
    return readSheetMock();
  }
  return readSheetReal();
}

/* ---- Comparación hoja vs DB ---- */

export type SheetDiff = {
  code: string;
  sheetStatus: BedStatus | null;
  sheetRaw: string;
  dbStatus: string;
  hasConflict: boolean;
};

export function diffSheetVsDb(
  sheetRows: SheetBedRow[],
  dbBeds: { code: string; status: string }[]
): SheetDiff[] {
  const dbMap = new Map(dbBeds.map((b) => [b.code, b.status]));
  const diffs: SheetDiff[] = [];
  for (const row of sheetRows) {
    const dbStatus = dbMap.get(row.code);
    if (!dbStatus) continue;
    const sheetParsed = parseSheetStatus(row.rawStatus);
    const hasConflict =
      sheetParsed !== null &&
      sheetParsed !== dbStatus &&
      !["discharge_detected", "stale"].includes(dbStatus);
    diffs.push({
      code: row.code,
      sheetStatus: sheetParsed,
      sheetRaw: row.rawStatus,
      dbStatus,
      hasConflict,
    });
  }
  return diffs;
}
