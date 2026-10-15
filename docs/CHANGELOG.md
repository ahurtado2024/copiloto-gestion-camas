# CHANGELOG

Todos los cambios significativos del proyecto, agrupados por versión.
Formato basado en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.0.0-beta] — 2026-10-14

### Agregado
- **Motor de negocio completo** (`engine.ts`, 1068 líneas) con las 12 reglas innegociables
- **8 tablas PostgreSQL** con Drizzle ORM: establishments, beds, cleaning_tasks, approvals, conflicts, messages, events, settings, shift_reports
- **15 rutas funcionales** incluyendo 3 vistas de detalle:
  - `/camas/[code]` — ficha completa de cama con historial, ciclo, propuestas, conflictos, mensajes
  - `/bandeja/[id]` — gestión completa de mensaje con seguimiento, hilo, borradores
  - `/limpieza/[code]` — detalle de ciclo con métricas por etapa
- **Ciclo canónico** alta→limpieza→inspección→disponible verificado de punta a punta
- **Sistema de propuestas** con vencimiento, obsolescencia y human-in-the-loop
- **Detección y resolución de conflictos** entre fuentes con criterio guardado
- **Neutralización de instrucciones externas** (R4) con registro en caja negra
- **Caja negra append-only** con idempotencia por dedupeKey
- **Mantenimiento perezoso** (vencimientos, escalados, datos stale) en cada lectura
- **Métricas M1–M8** calculadas desde la caja negra
- **Cierre de turno** con informe exportable
- **Configuración en caliente** de umbrales operativos desde `/ajustes`
- **Simulador de bandeja** con 6 escenarios (alta, solicitud, conflicto, datos faltantes, inyección, administrativo)
- **Interconexión total** — todo es navegable entre módulos
- **Separación visual de canales** Telegram vs Correo con identidad propia

### Arquitectura
- Punto único de mutación: `POST /api/ops`
- Server Components primero, Client Components mínimos
- Mantenimiento perezoso sin cron
- Configuración en caliente sin restart
- Validación de inputs estructurada (`validate.ts`)
- Manejo de errores tipado (`errors.ts`)
- Health check extendido con verificación de 4 subsistemas

### Documentación
- `docs/ROADMAP.md` — plan de producto v1.0→v3.0
- `docs/ARCHITECTURE.md` — arquitectura, stack, estructura, invariantes
- `docs/API-REFERENCE.md` — contrato completo de POST /api/ops
- `docs/DATA-DICTIONARY.md` — 9 tablas con columnas, tipos y reglas
- `docs/ERROR-HANDLING.md` — clasificación, capas de protección, escenarios
- `docs/TESTING-STRATEGY.md` — 5 niveles de testing, cobertura objetivo
- `docs/METRICAS-BASE.md` — plantilla para línea base manual
- `docs/CHANGELOG.md` — este archivo

### Diseño visual
- Tema claro profesional (fondo crema #FAFAF8, paneles blancos)
- KPI cards con fondos pasteles codificados por estado
- Badges tipo pill con colores semánticos
- Botón primario verde sólido, variantes contextuales
- Sidebar limpia con navegación por grupos

### Reglas innegociables implementadas
- **R1** Human-in-the-loop — toda acción relevante se propone y espera
- **R2** Nunca disponible por inferencia — bloqueo duro verificado
- **R3** No sobrescribir en silencio — conflictos congelan la escritura
- **R4** Contenido externo = dato — inyecciones neutralizadas
- **R5** No inventar — se pregunta cuando faltan datos
- **R6** Todo registrado con actor, hora y fuente — caja negra inmutable
- **R7** Idempotencia — repetir no duplica efectos
- **R8** Dato con vencimiento — mantenimiento perezoso marca stale
- **R9** Tiempos medidos por etapa — M1–M8 calculados
- **R10** Reversibilidad — toda acción se deshace con rastro
- **R11** Nunca punto único de fallo — modo degradado documentado
- **R12** Minimización — sin datos clínicos ni de pacientes

---

## [Unreleased]

### Pendiente para v1.0-stable
- Suite de tests automatizados (Vitest) para invariantes R1–R12
- Prueba de carga con 200 camas y 1000 eventos
- Revisión de seguridad (RLS, sanitización de HTML)
- Línea base real del usuario (METRICAS-BASE.md)

### Planificado para v1.1
- Integración real con Gmail API
- Telegram Bot para el canal del turno
- Webhooks entrantes para correo
