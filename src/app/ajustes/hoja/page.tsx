import { TableProperties, ArrowLeftRight, CheckCircle2, AlertTriangle, Info, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { readSheet, diffSheetVsDb } from "@/lib/sheets";
import { db } from "@/db";
import { beds } from "@/db/schema";
import { IS_DEMO, HAS_SHEETS } from "@/env";
import { PageHeader, Panel, PanelTitle, EmptyState } from "@/components/ui";
import { ago } from "@/lib/time";
import { Refresher } from "@/components/client";
import { SheetSyncButton } from "./client";

export const dynamic = "force-dynamic";

export default async function HojaPage() {
  const now = new Date();
  const sheetResult = await readSheet();
  const dbBeds = await db.select({ code: beds.code, status: beds.status }).from(beds);
  const diffs = diffSheetVsDb(sheetResult.rows, dbBeds);
  const conflicts = diffs.filter((d) => d.hasConflict);
  const matches = diffs.filter((d) => !d.hasConflict);

  return (
    <>
      <Refresher seconds={60} />
      <PageHeader
        kicker="Integración · la hoja ES la fuente operacional primaria"
        title="Google Sheets — Hoja del turno"
        desc="El copiloto LEE la hoja del turno en paralelo y compara su estado con el registro en Supabase. Si hay diferencias, abre un conflicto para que tú decidas. NUNCA sobreescribe la hoja (R3)."
        actions={<SheetSyncButton />}
      />

      {IS_DEMO && (
        <div className="rise mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Info size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="text-[12.5px] leading-relaxed text-amber-800">
            <b>Modo demo</b> — la hoja es simulada. Para conectar la hoja real, configura{" "}
            <code className="mono rounded bg-amber-100 px-1">GOOGLE_SHEETS_*</code> en{" "}
            <code className="mono rounded bg-amber-100 px-1">.env.local</code>. Ver <code>.env.example</code>.
          </div>
        </div>
      )}

      {!IS_DEMO && HAS_SHEETS && (
        <div className="rise mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          <div className="text-[12.5px] leading-relaxed text-emerald-800">
            <b>Integración activa</b> — el copiloto lee la hoja real. Última lectura:{" "}
            {ago(sheetResult.readAt, now)}.
          </div>
        </div>
      )}

      {/* estado de la integración */}
      <div className="rise grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { l: "filas en la hoja", v: String(sheetResult.rows.length), tone: "text-gray-900" },
          { l: "coinciden con registro", v: String(matches.length), tone: "text-emerald-700" },
          { l: "diferencias detectadas", v: String(conflicts.length), tone: conflicts.length ? "text-red-700" : "text-gray-900" },
          { l: "camas en Supabase", v: String(dbBeds.length), tone: "text-gray-900" },
        ].map((s) => (
          <Panel key={s.l} className="px-4 py-3">
            <div className="mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{s.l}</div>
            <div className={`mt-1 text-[22px] font-bold tabular-nums ${s.tone}`}>{s.v}</div>
          </Panel>
        ))}
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        {/* diferencias */}
        <Panel className="rise rise-1 xl:col-span-2">
          <PanelTitle icon={<ArrowLeftRight size={14} />}
            title="Comparación hoja vs. registro"
            sub="diferencias detectadas → conflictos para que tú decidas (R3, no sobreescribimos en silencio)"
            right={<span className="mono text-[10px] text-[var(--color-text-muted)]">{ago(sheetResult.readAt, now)}</span>} />
          {conflicts.length === 0 ? (
            <EmptyState icon={<CheckCircle2 size={17} />} title="Hoja y registro coinciden" desc="No hay diferencias entre lo que dice la hoja y el registro en Supabase." />
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {conflicts.map((d) => (
                <div key={d.code} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="mono text-[13px] font-bold text-[var(--color-text)]">{d.code}</span>
                  <div className="flex items-center gap-2 text-[11.5px]">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                      Registro: {d.dbStatus}
                    </span>
                    <span className="text-[var(--color-text-muted)]">≠</span>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                      Hoja: «{d.sheetRaw}»
                    </span>
                  </div>
                  <Link href="/conflictos" className="mono ml-auto text-[10px] text-emerald-700 hover:underline">
                    → resolver
                  </Link>
                </div>
              ))}
            </div>
          )}
          {matches.length > 0 && (
            <div className="border-t border-[var(--color-border)] px-4 py-3">
              <div className="mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Coincidencias</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {matches.map((d) => (
                  <span key={d.code} className="mono rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                    {d.code}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Panel>

        {/* configuración */}
        <div className="flex flex-col gap-3">
          <Panel className="rise rise-1">
            <PanelTitle icon={<TableProperties size={14} />} title="Configuración de la hoja" sub="columnas esperadas — ajustar a la hoja real" />
            <div className="divide-y divide-[var(--color-border)] px-4 py-1">
              {[
                ["Columna A", "Cama (código: C-304)"],
                ["Columna B", "Unidad (Medicina 3, UCI)"],
                ["Columna C", "Establecimiento (HRR, HSF)"],
                ["Columna D", "Estado (texto libre)"],
                ["Columna E", "Observaciones / Notas"],
              ].map(([col, desc]) => (
                <div key={col} className="flex items-center justify-between gap-2 py-2 text-[11.5px]">
                  <span className="mono text-[var(--color-text-muted)]">{col}</span>
                  <span className="text-[var(--color-text)]">{desc}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-[var(--color-border)] px-4 py-3">
              <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)]">
                Editar <code className="mono rounded bg-slate-100 px-1">src/lib/sheets.ts</code> → <code>EXPECTED_COLUMNS</code> para ajustar a las columnas reales de tu hoja.
              </p>
            </div>
          </Panel>

          <Panel className="rise rise-2">
            <PanelTitle icon={<Info size={14} />} title="Mapa de estados" sub="cómo se traduce el texto de la hoja" />
            <div className="divide-y divide-[var(--color-border)] px-4 py-1">
              {[
                ["«ocupada», «ocup», «o»", "occupied"],
                ["«disponible», «libre», «d»", "available"],
                ["«limpieza», «aseo»", "cleaning"],
                ["«p/l», «pend limpieza»", "pending_cleaning"],
                ["«inspección»", "pending_inspection"],
                ["«reservada»", "reserved"],
                ["«bloqueada», «blq»", "blocked"],
                ["«mantención», «mant»", "out_of_service"],
                ["«alta», «alta detectada»", "discharge_detected"],
                ["«?», «desconocido», vacío", "unknown"],
              ].map(([sheet, db]) => (
                <div key={sheet} className="flex items-center justify-between gap-2 py-1.5 text-[10.5px]">
                  <span className="mono text-[var(--color-text-muted)]">{sheet}</span>
                  <span className="mono rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{db}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-[var(--color-border)] px-4 py-3">
              <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)]">
                Editar <code className="mono rounded bg-slate-100 px-1">SHEET_STATUS_MAP</code> en <code>sheets.ts</code> para agregar los términos exactos que usa tu equipo.
              </p>
            </div>
          </Panel>

          <Panel className="rise rise-3 p-4">
            <div className="flex items-start gap-3">
              <ExternalLink size={15} className="mt-0.5 shrink-0 text-emerald-600" />
              <div>
                <div className="text-[12.5px] font-bold text-[var(--color-text)]">Activar integración real</div>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
                  1. Configurar <code className="mono rounded bg-slate-100 px-1">GOOGLE_SHEETS_*</code> en <code>.env.local</code><br />
                  2. Activar la Google Sheets API en tu proyecto de Google Cloud<br />
                  3. Compartir la hoja con el Service Account email<br />
                  4. Ejecutar Sync y verificar coincidencias
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
