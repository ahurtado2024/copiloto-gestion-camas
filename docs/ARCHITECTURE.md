# ARQUITECTURA DEL SISTEMA

> Documento vivo · Última actualización: 2026-10-14 · v1.0-beta

---

## 1. Vista general

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN                       │
│  Next.js App Router (RSC) · 15 rutas · Server Components     │
│  /tablero /camas /camas/[code] /limpieza /limpieza/[code]   │
│  /aprobaciones /conflictos /bandeja /bandeja/[id]           │
│  /turno /metricas /registro /ajustes                        │
├─────────────────────────────────────────────────────────────┤
│                    CAPA DE API                               │
│  POST /api/ops      ← punto único de mutación               │
│  GET  /api/health   ← healthcheck para infraestructura      │
├─────────────────────────────────────────────────────────────┤
│                    CAPA DE NEGOCIO                           │
│  engine.ts   ← motor (máquina de estados, reglas R1-R12)    │
│  inbox.ts    ← procesamiento de mensajes entrantes          │
│  metrics.ts  ← cálculo M1-M8 desde la caja negra           │
│  config.ts   ← configuración en caliente                    │
│  domain.ts   ← catálogos, estados, etiquetas                │
│  time.ts     ← utilidades de tiempo es-CL                   │
│  queries.ts  ← loaders de datos (ejecutan mantenimiento)    │
├─────────────────────────────────────────────────────────────┤
│                    CAPA DE DATOS                             │
│  PostgreSQL · Drizzle ORM                                    │
│  8 tablas: establishments, beds, cleaning_tasks, approvals,  │
│  conflicts, messages, events (append-only), settings         │
│  shift_reports                                               │
└─────────────────────────────────────────────────────────────┘
```

## 2. Principios de diseño

| Principio | Implementación |
|---|---|
| **Punto único de mutación** | Toda escritura pasa por `POST /api/ops` → `engine.ts`. No hay mutaciones dispersas. |
| **Server Components primero** | Las páginas son RSC que ejecutan queries directas a la BD. Solo `client.tsx` tiene estado. |
| **Mantenimiento perezoso** | Cada lectura ejecuta `ensureMaintenance()`: vencimientos, escalados, datos stale. Sin cron. |
| **Configuración en caliente** | `settings` tabla con `getRules()`. Cambios se aplican en el siguiente request. |
| **Idempotencia** | `events.dedupeKey` con `ON CONFLICT DO NOTHING`. Mensajes con `externalId` único. |
| **Inmutabilidad de la caja negra** | `events` es append-only. No hay UPDATE ni DELETE en código. |

## 3. Modelo de datos (ERD)

```
establishments ──┐
                  │ 1:N
beds ◄────────────┘
  │
  ├── cleaning_tasks (1:N, ciclo de aseo)
  │     └── approvals (1:N, inspecciones)
  │
  ├── approvals (1:N, propuestas de alta, borradores)
  │
  ├── conflicts (1:N, contradicciones entre fuentes)
  │
  ├── messages (1:N, correos/mensajes vinculados)
  │     └── messages.inReplyTo (self-ref, hilos)
  │
  └── events (1:N, caja negra)

settings (key/value, configuración)
shift_reports (informes de turno)
```

## 4. Flujo de una operación típica

```
1. Usuario hace click "Confirmar alta" en la UI
2. Client Component llama POST /api/ops { op: "decide_approval", params: {...} }
3. route.ts valida → llama engine.decideApproval()
4. engine.ts:
   a. ensureMaintenance() — caduca propuestas vencidas, escala tareas, marca stale
   b. Valida precondiciones (estado actual, conflictos, vencimiento)
   c. Ejecuta la transición de estado en beds/cleaning_tasks/approvals
   d. Registra eventos en la caja negra (logEvent con dedupeKey)
   e. Retorna OpResult { ok, message, tone }
5. route.ts retorna JSON al cliente
6. Client Component muestra toast + router.refresh()
7. Server Component re-renderiza con datos frescos
```

## 5. Máquina de estados de cama

```
                              ┌─────────┐
                              │ occupied │◄──────────────────────┐
                              └────┬─────┘                      │
                                   │ proposeDischarge()          │ cancelTask
                              ┌────▼────────────────┐           │ / rejectDischarge
                              │ discharge_detected   │───────────┘
                              └────┬────────────────┘
                                   │ approveDischarge (R1)
                              ┌────▼────────────┐
                              │ pending_cleaning │
                              └────┬────────────┘
                                   │ taskAction("start")
                              ┌────▼─────┐
                              │ cleaning  │◄─── rejectInspection
                              └────┬─────┘
                                   │ taskAction("finish")
                              ┌────▼──────────────┐
                              │ pending_inspection │
                              └────┬──────────────┘
                                   │ approveInspection (R1+R2)
                              ┌────▼───────┐
                  ┌──reserve──│ available   │
                  │           └────────────┘
                  ▼                ▲
            ┌──────────┐          │ release
            │ reserved  │─────────┘
            └──────────┘

Estados ortogonales:
  blocked ←→ (cualquier estado excepto available)
  out_of_service ←→ unknown (reincorporar)
  unknown → occupied | discharge_detected (proponer alta)
  stale = flag calculado (R8), no estado persistido
```

## 6. Invariantes del sistema (probados en cada operación)

| ID | Invariante | Cómo se cumple |
|----|---|---|
| INV-1 | No existe camino a `available` sin `inspection_approval.approved` | `bedAction("mark_available")` siempre retorna `fail()` |
| INV-2 | Una cama con conflicto abierto no acepta mutaciones | Check explícito en `bedAction()` y `proposeDischarge()` |
| INV-3 | Una propuesta vencida no se puede aprobar | Check en `decideApproval()` |
| INV-4 | Una propuesta obsoleta (condición cambió) no se aplica | Mantenimiento perezoso + check en `decideApproval()` |
| INV-5 | Repetir un evento no duplica efectos | `dedupeKey` con `ON CONFLICT DO NOTHING` |
| INV-6 | No se puede saltar etapas del ciclo de aseo | `need()` valida estado previo en `taskAction()` |
| INV-7 | Todo cambio tiene al menos un registro en `events` | `logEvent()` en cada rama de cada operación |

## 7. Stack tecnológico

| Capa | Tecnología | Versión | Justificación |
|---|---|---|---|
| Runtime | Node.js | 22.x | LTS estable |
| Framework | Next.js (App Router) | 16.2 | RSC, streaming, API routes en un solo deploy |
| ORM | Drizzle | 0.45 | Type-safe, sin code generation pesado, push directo |
| Base de datos | PostgreSQL | 16 | Estándar, JSONB, índices parciales |
| UI | Tailwind CSS 4 | 4.1 | Utilidades atómicas, zero-runtime |
| Iconos | Lucide React | latest | Tree-shakeable, consistente |
| Fuentes | Space Grotesk + IBM Plex Mono | — | Legibilidad operativa |

## 8. Estructura de archivos

```
src/
├── app/                    # Next.js App Router
│   ├── api/
│   │   ├── health/         # GET /api/health
│   │   └── ops/            # POST /api/ops (punto único de mutación)
│   ├── ajustes/            # /ajustes
│   ├── aprobaciones/       # /aprobaciones
│   ├── bandeja/
│   │   ├── [id]/           # /bandeja/:id (detalle de mensaje)
│   │   └── page.tsx        # /bandeja
│   ├── camas/
│   │   ├── [code]/         # /camas/:code (detalle de cama)
│   │   └── page.tsx        # /camas
│   ├── conflictos/         # /conflictos
│   ├── limpieza/
│   │   ├── [code]/         # /limpieza/:code (detalle de tarea)
│   │   └── page.tsx        # /limpieza
│   ├── metricas/           # /metricas
│   ├── registro/           # /registro (caja negra)
│   ├── turno/              # /turno (cierre e informe)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx            # /tablero
├── components/
│   ├── bedactions.tsx      # Acciones de cama (reutilizable)
│   ├── client.tsx          # Todos los Client Components
│   ├── links.tsx           # Links de interconexión + ChannelBadge
│   ├── shell.tsx           # Layout principal (sidebar + header)
│   ├── taskcard.tsx        # Tarjeta de tarea de limpieza
│   └── ui.tsx              # Primitivos de UI (Panel, Stat, Badge, etc.)
├── db/
│   ├── index.ts            # Pool + cliente Drizzle
│   └── schema.ts           # 8 tablas con tipos inferidos
├── lib/
│   ├── config.ts           # Configuración en caliente (getRules)
│   ├── domain.ts           # Catálogos de dominio (estados, etiquetas, reglas)
│   ├── engine.ts           # Motor de negocio (1068 líneas)
│   ├── inbox.ts            # Procesamiento de mensajes entrantes
│   ├── metrics.ts          # Cálculo de métricas M1-M8
│   ├── queries.ts          # Loaders para las vistas (con mantenimiento perezoso)
│   └── time.ts             # Utilidades de fecha/hora es-CL
├── docs/                   # Documentación de ingeniería
└── scripts/
    └── seed.ts             # Datos ficticios determinísticos
```
