import { BookOpen, FileText, Database, AlertTriangle, TestTube, BarChart3, ClipboardList, GitBranch, Layers, CheckSquare, GitCommit, TableProperties } from "lucide-react";
import Link from "next/link";
import { PageHeader, Panel, PanelTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

const DOCS = [
  { file: "ROADMAP.md", title: "Roadmap de producto", desc: "Plan v1.0→v3.0 con criterios de paso entre fases. Metodología Shape Up: apuestas de 6 semanas con evidencia.", icon: <GitBranch size={16} /> },
  { file: "REAL-TEST-READINESS.md", title: "Cuándo pasar a entorno real", desc: "Criterio ejecutivo/técnico para decidir cuándo salir del sandbox, cuándo entrar a staging y cuándo todavía no pilotear.", icon: <GitBranch size={16} /> },
  { file: "DEPLOYMENT-PLAYBOOK.md", title: "Playbook de traspaso", desc: "Guía paso a paso para mover el proyecto a GitHub + Cursor + Supabase + Vercel y cómo seguir actualizándolo con branches, previews y staging.", icon: <FileText size={16} /> },
  { file: "ENVIRONMENT-STRATEGY.md", title: "Estrategia de entornos", desc: "Separación Sandbox / DEV / STAGING / PILOT, secretos por entorno y reglas de promoción entre ambientes.", icon: <Database size={16} /> },
  { file: "ARCHITECTURE.md", title: "Arquitectura del sistema", desc: "Capas, flujo de una operación, máquina de estados, invariantes, stack tecnológico y estructura de archivos.", icon: <Database size={16} /> },
  { file: "API-REFERENCE.md", title: "Referencia de API", desc: "Contrato completo de POST /api/ops: operaciones, parámetros, precondiciones y códigos de error.", icon: <FileText size={16} /> },
  { file: "DATA-DICTIONARY.md", title: "Diccionario de datos", desc: "9 tablas con columnas, tipos, restricciones, índices y reglas de negocio asociadas a cada campo.", icon: <Database size={16} /> },
  { file: "ERROR-HANDLING.md", title: "Manejo de errores", desc: "Clasificación por ErrorCode, capas de protección (validación → motor → API → modo degradado), escenarios probados.", icon: <AlertTriangle size={16} /> },
  { file: "TESTING-STRATEGY.md", title: "Estrategia de testing", desc: "5 niveles: invariantes R1-R12, ciclo canónico, escenarios de bandeja, métricas, validación de inputs.", icon: <TestTube size={16} /> },
  { file: "METRICAS-BASE.md", title: "Línea base manual", desc: "Plantilla para que el usuario mida el proceso actual antes de la intervención. Sin esto, todo es opinión.", icon: <BarChart3 size={16} /> },
  { file: "STACK-GUIDE.md", title: "Guía de stack", desc: "Qué herramientas necesitamos, cuándo entra cada una y por qué. GitHub + Cursor + Supabase + Vercel + Sheets + Gmail + Telegram + Auth.", icon: <Layers size={16} /> },
  { file: "TOOLING-MATRIX.md", title: "Matriz de herramientas", desc: "Qué herramientas son obligatorias, recomendadas y opcionales según la fase del proyecto.", icon: <Layers size={16} /> },
  { file: "TRANSFER-RUNBOOK.md", title: "Runbook de traspaso", desc: "Ejecución paso a paso para mover el proyecto a GitHub + Cursor + Supabase + Vercel con la hoja del turno como fuente primaria.", icon: <FileText size={16} /> },
  { file: "SOURCE-OF-TRUTH-POLICY.md", title: "Política de fuente de verdad", desc: "La hoja opera. Supabase recuerda. Regla explícita de arbitraje entre hoja y registro paralelo.", icon: <TableProperties size={16} /> },
  { file: "RELEASE-CHECKLIST.md", title: "Checklist de release", desc: "Lista de verificación antes de cada merge: código, smoke tests, invariantes del motor y gate de piloto.", icon: <CheckSquare size={16} /> },
  { file: "COMMIT-CONVENTION.md", title: "Convención de commits", desc: "Tipos, alcances, ejemplos y naming de branches. Conventional Commits en español.", icon: <GitCommit size={16} /> },
  { file: "CHANGELOG.md", title: "Changelog", desc: "Todos los cambios significativos por versión, con detalle de features, arquitectura y reglas implementadas.", icon: <ClipboardList size={16} /> },
];

export default function DocsPage() {
  return (
    <>
      <PageHeader
        kicker="Ingeniería de software · documentación viva"
        title="Documentación del proyecto"
        desc="Cada documento cubre un aspecto del proyecto siguiendo los circuitos y procedimientos de equipos de ingeniería de excelencia: roadmap con criterios de paso, arquitectura con invariantes, API con contratos, datos con diccionario, errores con clasificación, testing con estrategia, y línea base con metodología."
      />

      <div className="grid gap-3 md:grid-cols-2">
        {DOCS.map((d) => (
          <div key={d.file} className="panel panel-hover p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                {d.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[14px] font-bold text-[var(--color-text)]">{d.title}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">{d.desc}</p>
                <div className="mono mt-2 text-[10px] text-[var(--color-text-muted)]">docs/{d.file}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Panel className="rise rise-1 mt-6">
        <PanelTitle icon={<BookOpen size={14} />} title="Proceso de ingeniería" sub="cómo se construye y se revisa este proyecto" />
        <div className="grid gap-0 md:grid-cols-2">
          <div className="border-b border-[var(--color-border)] p-5 md:border-b-0 md:border-r">
            <h4 className="text-[13px] font-bold text-[var(--color-text)]">Ciclo de desarrollo</h4>
            <div className="mt-2 space-y-2">
              {[
                ["1. Handoff de negocio", "El objeto se define antes de tocar código. El HANDOFF tiene reglas de lectura."],
                ["2. Diseño del motor", "Las reglas innegociables (R1-R12) se codifican como invariantes verificables."],
                ["3. Implementación con tests", "Cada regla tiene un escenario que intenta violarla y verifica el rechazo."],
                ["4. Validación completa", "typegen → tsc → build → build_and_start → smoke tests de API."],
                ["5. Documentación", "Cada decisión queda documentada con su razón de negocio."],
                ["6. Revisión con el usuario", "Criterios de éxito numéricos (M1-M8), no sensaciones."],
              ].map(([t, d]) => (
                <div key={t}>
                  <div className="text-[12px] font-semibold text-[var(--color-text)]">{t}</div>
                  <div className="text-[11px] text-[var(--color-text-muted)]">{d}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-5">
            <h4 className="text-[13px] font-bold text-[var(--color-text)]">Herramientas e instrumentos</h4>
            <div className="mt-2 space-y-2">
              {[
                ["Shape Up (6 semanas)", "Cada versión es una apuesta con appetite fijo y criterio de paso explícito."],
                ["Invariantes verificables", "Cada regla R1-R12 tiene un test que la viola y verifica el rechazo."],
                ["Caja negra inmutable", "30+ tipos de eventos con actor, hora, fuente y correlación. Nunca se edita."],
                ["Mantenimiento perezoso", "Sin cron ni workers: cada lectura ejecuta vencimientos, escalados y stale."],
                ["Punto único de mutación", "POST /api/ops. No hay escrituras dispersas. Todo pasa por el motor."],
                ["Configuración en caliente", "settings tabla + getRules(). Cambios sin restart ni deploy."],
                ["Validación en capas", "validate.ts → engine.ts → route.ts. OperationalError tipado con ErrorCode."],
                ["Health check extendido", "4 subsistemas verificados: BD, esquema, config, caja negra."],
              ].map(([t, d]) => (
                <div key={t}>
                  <div className="text-[12px] font-semibold text-[var(--color-text)]">{t}</div>
                  <div className="text-[11px] text-[var(--color-text-muted)]">{d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="rise rise-2 mt-3">
        <PanelTitle icon={<AlertTriangle size={14} />} title="Preguntas abiertas — un LLM debe preguntar, no rellenar" sub="bloqueantes para las siguientes fases" />
        <div className="grid gap-3 p-5 md:grid-cols-2">
          {[
            "¿Cuántas camas y cuántos establecimientos tiene la red bajo esta coordinación?",
            "¿Cuál es la línea base real (M1, M2, M3)? → llenar METRICAS-BASE.md",
            "¿Quién es 'aseo/limpieza' y por qué canal responde hoy?",
            "¿Qué campos de la hoja son obligatorios y cuáles son ruido heredado?",
            "¿Qué formato exacto carga el software oficial?",
            "¿Qué estado de cama existe en la práctica y no está en el catálogo de 12?",
            "¿Quién decide cuando la hoja y el correo se contradicen?",
            "¿Retención de registros: cuánto tiempo y con qué política de borrado?",
            "¿Qué haría al usuario dejar de usar el sistema, aunque funcione?",
            "¿Hay normativa local sobre qué puede automatizarse en gestión de camas?",
          ].map((q, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <span className="mono mt-0.5 shrink-0 text-[10px] font-bold text-amber-600">P{i + 1}</span>
              <span className="text-[11.5px] leading-snug text-amber-800">{q}</span>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
