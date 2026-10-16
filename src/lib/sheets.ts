/* ------------------------------------------------------------------ */
/*  MÓDULO DE INTEGRACIÓN CON GOOGLE SHEETS                            */
/*                                                                     */
/*  PRINCIPIO CLAVE del negocio:                                       */
/*  La hoja ES la fuente operacional primaria.                         */
/*  Supabase es el REGISTRO EN PARALELO: backup, auditoría, métricas.  */
/*  El copiloto LEE la hoja — NUNCA la sobreescribe en el MVP.        */
/*                                                                     */
/*  Flujo:                                                             */
/*  Hoja (encargado escribe) → lectura periódica → comparación         */
/*    → si coincide: registro actualizado silencioso                   */
/*    → si difiere: conflicto abierto → espera al humano (R3)          */
/*                                                                     */
/*  Estado: preparado para integración real (v1.2)                    */
/*  Actualmente: retorna datos ficticios si HAS_SHEETS=false           */
/* ------------------------------------------------------------------ */

import { HAS_SHEETS } from "@/env";
import type { BedStatus } from "./domain";
import { Type } from "lucide-react";

export type SheetBedRow = {
  code: string;              // C-304
  unit: string;              // Medicina 3
  estCode: string;           // HRR
  status: BedStatus | null;  // lo que dice la hoja (puede ser null si está vacío)
  rawStatus: string;         // texto literal de la hoja sin procesar
  note: string;              // columna de notas del encargado
  lastEditedBy: string;      // nombre del usuario que editó la celda
  lastEditedAt: Date | null; // timestamp de la última edición
  rowIndex: number;          // fila en la hoja (para debugging)
};

export type SheetReadResult = {
  ok: boolean;
  rows: SheetBedRow[];
  readAt: Date;
  error?: string;
  spreadsheetId?: string;
  sheetName?: string;
};

/* ------------------------------------------------------------------ */
/*  Mapeo del texto de la hoja a estados del dominio                   */
/*                                                                     */
/*  AJUSTAR según los valores reales de la hoja del encargado.         */
/*  Si la hoja dice "limpieza" → `cleaning`                            */
/*  Si la hoja dice "disponible" → `available`                         */
/*  etc.                                                               */
/* ------------------------------------------------------------------ */
const SHEET_STATUS_MAP: Record<string, BedStatus> = {
  // Estado texto en la hoja → BedStatus interno
  "ocupada":              "occupied",
  "ocupado":              "occupied",
  "ocup":                 "occupied",
  "o":                    "occupied",
  "disponible":           "available",
  "disp":                 "available",
  "d":                    "available",
  "libre":                "available",
  "limpieza":             "cleaning",
  "en limpieza":          "cleaning",
  "aseo":                 "cleaning",
  "pendiente limpieza":   "pending_cleaning",
  "pend limpieza":        "pending_cleaning",
  "p/l":                  "pending_cleaning",
  "inspección":           "pending_inspection",
  "inspeccion":           "pending_inspection",
  "reservada":            "reserved",
  "reservado":            "reserved",
  "res":                  "reserved",
  "bloqueada":            "blocked",
  "bloqueado":            "blocked",
  "blq":                  "blocked",
  "mantención":           "out_of_service",
  "mantencion":           "out_of_service",
  "mant":                 "out_of_service",
  "fuera de servicio":    "out_of_service",
  "alta detectada":       "discharge_detected",
  "alta":                 "discharge_detected",
  "desconocido":          "unknown",
  "desc":                 "unknown",
  "?":                    "unknown",
  "":                     "unknown",
};

export function parseSheetStatus(raw: string): BedStatus | null {
  const normalized = raw.toLowerCase().trim().replace(/\s+/g, " ");
  return SHEET_STATUS_MAP[normalized] ?? null;
}

/* ------------------------------------------------------------------ */
/*  Validación de columnas esperadas                                   */
/*  AJUSTAR con las columnas reales de la hoja del equipo.             */
/* ------------------------------------------------------------------ */
export const EXPECTED_COLUMNS = {
  CODE:     { index: 0, header: "Cama" },        // Columna A
  UNIT:     { index: 1, header: "Unidad" },       // Columna B
  EST:      { index: 2, header: "Establecimiento"}, // Columna C
  TYPE:     { index: 3, header: "Tipo"}, // Columna D
  STATUS:   { index: 4, header: "Estado" },       // Columna E
  ACT:      { index: 5, header: "Ultima Actualizacion" },       // Columna F
  USER:     { index: 6, header: "Actualizado por" },       // Columna G
  NOTE:     { index: 7, header: "Observaciones" },// Columna H
} as const;

/* ------------------------------------------------------------------ */
/*  Lectura real de Google Sheets                                       */
/*  Requiere: GOOGLE_SHEETS_* en .env.local                           */
/* ------------------------------------------------------------------ */
async function readSheetReal(): Promise<SheetReadResult> {
  // Esta implementación requiere googleapis npm package
  // npm install googleapis
  // Se activa cuando HAS_SHEETS = true
  throw new Error(
    "La integración con Google Sheets aún no está activada. " +
    "Configura GOOGLE_SHEETS_* en .env.local (ver .env.example)."
  );
}

/* ------------------------------------------------------------------ */
/*  Lectura simulada para demo/dev sin credenciales                    */
/* ------------------------------------------------------------------ */
function readSheetMock(): SheetReadResult {
  const now = new Date();
  return {
    ok: true,
    readAt: now,
    spreadsheetId: "DEMO_SIMULADO",
    sheetName: "Turno",
    rows: [
      // Datos ficticios que simulan el estado real de la hoja
      { code: "C-301", unit: "Medicina 3", estCode: "HRR", status: "occupied",   rawStatus: "ocupada",    note: "",                     lastEditedBy: "M. Rojas", lastEditedAt: new Date(now.getTime() - 7200000), rowIndex: 2 },
      { code: "C-304", unit: "Medicina 3", estCode: "HRR", status: "available",  rawStatus: "disponible", note: "Insp ok 08:30",         lastEditedBy: "M. Rojas", lastEditedAt: new Date(now.getTime() - 1800000), rowIndex: 5 },
      { code: "C-306", unit: "Medicina 3", estCode: "HRR", status: "cleaning",   rawStatus: "limpieza",   note: "Aseo en camino",        lastEditedBy: "M. Rojas", lastEditedAt: new Date(now.getTime() - 900000),  rowIndex: 7 },
      { code: "U-01",  unit: "UCI",        estCode: "HRR", status: "occupied",   rawStatus: "ocupada",    note: "",                     lastEditedBy: "J. Paredes", lastEditedAt: new Date(now.getTime() - 3600000), rowIndex: 12 },
      { code: "U-02",  unit: "UCI",        estCode: "HRR", status: "available",  rawStatus: "libre",      note: "Lista",                lastEditedBy: "J. Paredes", lastEditedAt: new Date(now.getTime() - 600000), rowIndex: 13 },
      { code: "F-103", unit: "Medicina 1", estCode: "HSF", status: "available",  rawStatus: "disponible", note: "",                     lastEditedBy: "J. Paredes", lastEditedAt: new Date(now.getTime() - 2400000), rowIndex: 20 },
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Punto de entrada principal                                          */
/* ------------------------------------------------------------------ */
export async function readSheet(): Promise<SheetReadResult> {
  if (!HAS_SHEETS) {
    return readSheetMock();
  }
  try {
    return await readSheetReal();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al leer la hoja";
    return {
      ok: false,
      rows: [],
      readAt: new Date(),
      error: msg,
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Análisis de diferencias (hoja vs registro paralelo)                */
/*                                                                     */
/*  Compara lo que dice la hoja con lo que tiene el registro.          */
/*  Si hay diferencia → produce un conflicto para que el humano        */
/*  decida cuál es la fuente correcta (R3).                            */
/* ------------------------------------------------------------------ */
export type SheetDiff = {
  code: string;
  sheetStatus: BedStatus | null;
  sheetRaw: string;
  dbStatus: string;
  hasConflict: boolean;
  note: string;
};

export function diffSheetVsDb(
  sheetRows: SheetBedRow[],
  dbBeds: { code: string; status: string }[]
): SheetDiff[] {
  const dbMap = new Map(dbBeds.map((b) => [b.code, b.status]));
  const diffs: SheetDiff[] = [];
  for (const row of sheetRows) {
    const dbStatus = dbMap.get(row.code);
    if (!dbStatus) continue; // la cama no está registrada aún — se ignora
    const sheetParsed = parseSheetStatus(row.rawStatus);
    // Hay conflicto si la hoja dice algo reconocible Y es diferente al registro
    const hasConflict =
      sheetParsed !== null &&
      sheetParsed !== dbStatus &&
      // Algunos estados del registro no tienen equivalente en la hoja → sin conflicto
      !["discharge_detected", "stale"].includes(dbStatus);
    diffs.push({
      code: row.code,
      sheetStatus: sheetParsed,
      sheetRaw: row.rawStatus,
      dbStatus,
      hasConflict,
      note: row.note,
    });
  }
  return diffs;
}
