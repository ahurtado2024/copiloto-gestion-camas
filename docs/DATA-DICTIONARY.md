# DICCIONARIO DE DATOS

> Cada tabla con su propósito, columnas, tipos, restricciones y reglas de negocio asociadas.
> Última actualización: 2026-10-14

---

## 1. `establishments` — Red asistencial

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | serial | PK | Identificador interno |
| `code` | text | NOT NULL, UNIQUE | Código corto: HRR, HSF, SRG |
| `name` | text | NOT NULL | Nombre completo del establecimiento |
| `kind` | text | NOT NULL | Tipo: `hospital` · `sar` · `clinica` |

**Regla de negocio:** un establecimiento define el perímetro de gestión. Las camas pertenecen a exactamente un establecimiento.

---

## 2. `beds` — Camas de la red

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | serial | PK | Identificador interno |
| `code` | text | NOT NULL, UNIQUE | Código visible: C-304, U-01, F-102 |
| `establishment_id` | integer | FK → establishments.id, NOT NULL | Establecimiento al que pertenece |
| `unit` | text | NOT NULL | Unidad/servicio: Medicina 3, UCI, Cirugía 2 |
| `bed_type` | text | NOT NULL | Tipo: `basica` · `media` · `critica` · `aislamiento` |
| `status` | text | NOT NULL, default `unknown` | Estado operativo actual (12 valores posibles) |
| `status_since` | timestamptz | NOT NULL, default now | Desde cuándo está en este estado |
| `last_confirmed_at` | timestamptz | NOT NULL, default now | Última confirmación HUMANA del dato (R8) |
| `note` | text | nullable | Nota operativa visible en la tarjeta |

**Índices:** `beds_status_idx` (status), `beds_est_idx` (establishment_id)

**Estados posibles** (columna `status`):
```
occupied · discharge_detected · pending_cleaning · cleaning
cleaning_completed · pending_inspection · available · reserved
blocked · out_of_service · unknown
```

**Nota:** `stale` no es un estado persistido — es un flag calculado en runtime cuando `last_confirmed_at` supera la frescura configurada (R8).

**Reglas:**
- **R2:** No existe transición directa a `available`. Solo `inspection_approval.approved` la produce.
- **R3:** Una cama con conflicto abierto no acepta mutaciones (excepto `reconfirm` y `mark_unknown`).
- **R8:** `last_confirmed_at` alimenta el cálculo de "dato vencido". Configuración: `settings.frescura_horas`.

---

## 3. `cleaning_tasks` — Ciclos de aseo

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | serial | PK | Identificador interno |
| `code` | text | NOT NULL, UNIQUE | Código legible: LMP-20261014-0007 |
| `bed_id` | integer | FK → beds.id, NOT NULL | Cama del ciclo |
| `status` | text | NOT NULL, default `pending_notice` | Estado del ciclo (9 valores) |
| `priority` | text | NOT NULL, default `normal` | Prioridad: `normal` · `alta` · `critica` |
| `channel` | text | NOT NULL, default `telegram` | Canal por el que se avisó a aseo |
| `detected_at` | timestamptz | NOT NULL | Momento de la detección del alta |
| `created_at` | timestamptz | NOT NULL, default now | Creación de la tarea |
| `notified_at` | timestamptz | nullable | Aviso enviado a aseo |
| `accepted_at` | timestamptz | nullable | Aseo tomó el trabajo |
| `started_at` | timestamptz | nullable | Limpieza iniciada |
| `finished_at` | timestamptz | nullable | Aseo informó término |
| `inspected_at` | timestamptz | nullable | Inspección humana validada |
| `closed_at` | timestamptz | nullable | Cierre del ciclo |
| `cancelled_at` | timestamptz | nullable | Anulación |
| `cancel_reason` | text | nullable | Motivo de anulación |
| `blocked_reason` | text | nullable | Motivo de impedimento activo |

**Estados:** `pending_notice → notified → accepted → cleaning → cleaning_completed → pending_inspection → completed`
Ramas: `→ cancelled`, `→ blocked` (temporal)

**Métricas calculadas:**
- M1 = `notified_at - detected_at` (minutos)
- M2 = `closed_at - detected_at` (minutos)

---

## 4. `approvals` — Propuestas human-in-the-loop

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | serial | PK | |
| `code` | text | NOT NULL, UNIQUE | Código legible: APR-0007 |
| `kind` | text | NOT NULL | Tipo: `discharge_confirmation` · `inspection_approval` · `reply_draft` |
| `title` | text | NOT NULL | Pregunta al humano |
| `detail` | text | NOT NULL | Contexto y evidencia |
| `bed_id` | integer | FK → beds.id, nullable | Cama asociada |
| `task_id` | integer | FK → cleaning_tasks.id, nullable | Tarea asociada |
| `message_id` | integer | nullable | Mensaje de correo asociado |
| `payload` | jsonb | NOT NULL, default {} | Datos adicionales: `assumedStatus`, `previousStatus`, `draftBody`, etc. |
| `status` | text | NOT NULL, default `pending` | Estado: `pending` · `approved` · `rejected` · `expired` · `superseded` |
| `created_at` | timestamptz | NOT NULL | |
| `expires_at` | timestamptz | NOT NULL | Vencimiento — tras este momento, `pending` → `expired` automáticamente |
| `decided_by` | text | nullable | Quién decidió |
| `decided_at` | timestamptz | nullable | Cuándo decidió |
| `decision_reason` | text | nullable | Motivo del rechazo |
| `applied_at` | timestamptz | nullable | Cuándo se aplicó el efecto |
| `outcome_note` | text | nullable | Nota del desenlace (para vencidas/obsoletas) |

**Reglas:**
- **R1:** Toda acción relevante se propone y espera autorización aquí.
- Una propuesta vencida (`expired`) no se puede aprobar después.
- Si la cama cambió de estado desde que se creó, queda `superseded`.

---

## 5. `conflicts` — Contradicciones entre fuentes

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | serial | PK | |
| `bed_id` | integer | FK → beds.id, NOT NULL | Cama en disputa |
| `source_a` | text | NOT NULL | Nombre de la fuente A |
| `value_a` | text | NOT NULL | Lo que dice la fuente A |
| `source_b` | text | NOT NULL | Nombre de la fuente B |
| `value_b` | text | NOT NULL | Lo que dice la fuente B |
| `status` | text | NOT NULL, default `open` | `open` · `resolved` |
| `resolution` | text | nullable | Valor ganador |
| `criterion` | text | nullable | Criterio del humano (obligatorio al resolver) |
| `resolved_by` | text | nullable | Quién resolvió |
| `created_at` | timestamptz | NOT NULL | |
| `resolved_at` | timestamptz | nullable | |

**Regla R3:** Mientras un conflicto esté abierto sobre una cama, **no se acepta ninguna escritura automática** sobre esa cama (excepto `reconfirm` y `mark_unknown`).

---

## 6. `messages` — Correos y mensajes

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | serial | PK | |
| `external_id` | text | NOT NULL, UNIQUE | Identificador de idempotencia (R7) |
| `channel` | text | NOT NULL | `correo` · `telegram` · `whatsapp` |
| `direction` | text | NOT NULL, default `inbound` | `inbound` · `outbound` |
| `from_name` | text | NOT NULL | Remitente visible |
| `subject` | text | NOT NULL | Asunto |
| `body` | text | NOT NULL | Contenido íntegro |
| `received_at` | timestamptz | NOT NULL | |
| `classification` | text | nullable | `alta` · `solicitud_cama` · `oferta` · `confirmacion` · `conflicto` · `administrativo` · `instruccion_sistema` · `duplicado` |
| `extracted` | jsonb | NOT NULL, default {} | Datos extraídos: `cama`, `unidad`, `confianza`, `faltan` |
| `status` | text | NOT NULL, default `nuevo` | `nuevo` · `clasificado` · `vinculado` · `pendiente_datos` · `atendido` · `no_aplica` · `duplicado` · `enviado` |
| `bed_id` | integer | FK → beds.id, nullable | Cama vinculada |
| `in_reply_to` | integer | nullable | Self-reference: hilo de respuestas |
| `handled_by` | text | nullable | |
| `handled_at` | timestamptz | nullable | |

---

## 7. `events` — Caja negra (append-only)

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | serial | PK | |
| `dedupe_key` | text | UNIQUE, nullable | Clave de idempotencia (R7) |
| `ts` | timestamptz | NOT NULL, default now | Momento del evento |
| `actor` | text | NOT NULL | `sistema` · `encargada` · `aseo` · `jefatura` · `externo` |
| `source` | text | NOT NULL | `correo` · `telegram` · `hoja` · `sistema` · `panel` |
| `kind` | text | NOT NULL | Tipo de evento (30+ tipos definidos en `domain.ts`) |
| `bed_id` | integer | FK → beds.id, nullable | Cama asociada |
| `task_id` | integer | FK → cleaning_tasks.id, nullable | Tarea asociada |
| `approval_id` | integer | FK → approvals.id, nullable | Propuesta asociada |
| `summary` | text | NOT NULL | Descripción legible del evento |
| `payload` | jsonb | NOT NULL, default {} | Datos adicionales: `cycle_minutes`, `m1_minutes`, `conflictId`, etc. |

**Regla R6:** Esta tabla **nunca se edita ni se borra**. `INSERT ... ON CONFLICT DO NOTHING` garantiza idempotencia.

---

## 8. `settings` — Configuración en caliente

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `key` | text | PK | Clave: `sla_limpieza_min`, `frescura_horas`, etc. |
| `value` | text | NOT NULL | Valor como string (se parsea según tipo) |

Claves definidas en `config.ts → SETTING_DEFS`.

---

## 9. `shift_reports` — Informes de turno

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | serial | PK | |
| `label` | text | NOT NULL | "Turno día · 14 oct 14:30" |
| `generated_by` | text | NOT NULL | |
| `generated_at` | timestamptz | NOT NULL | |
| `horizon_hours` | integer | NOT NULL, default 12 | Ventana hacia atrás |
| `content` | jsonb | NOT NULL | Estructura completa del informe |
