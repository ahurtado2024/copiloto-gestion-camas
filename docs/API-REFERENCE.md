# API REFERENCE — POST /api/ops

> Punto único de mutación. Toda escritura pasa por aquí.
> Cada operación retorna `OpResult { ok: boolean; message: string; tone: "ok"|"warn"|"error" }`.

---

## Contrato general

```
POST /api/ops
Content-Type: application/json

{
  "op": "<nombre_operación>",
  "params": { <parámetros_específicos> }
}

→ 200 { "ok": true|false, "message": "...", "tone": "ok"|"warn"|"error" }
```

En caso de error del sistema (excepción no controlada), retorna 200 con `ok: false` y mensaje de modo degradado (R11).

---

## Operaciones de cama

### `bed` — Acciones directas del humano sobre camas

```json
{ "op": "bed", "params": { "bedId": 5, "bedOp": "<acción>", "reason": "..." } }
```

| bedOp | Descripción | Precondiciones | Resultado |
|---|---|---|---|
| `propose_discharge` | Detectar un alta posible | Estado `occupied` o `unknown`, sin conflicto abierto | Cama → `discharge_detected`, crea propuesta APR con TTL |
| `reserve` | Reservar cama disponible | Estado `available`, dato no vencido | Cama → `reserved` |
| `release` | Liberar reserva | Estado `reserved` | Cama → `available` |
| `block` | Bloquear cama | No `out_of_service`, sin ciclo de aseo abierto | Cama → `blocked` |
| `out_of_service` | Dar de baja | Sin ciclo de aseo abierto | Cama → `out_of_service` |
| `reincorporate` | Reincorporar | Estado `blocked` o `out_of_service` | Cama → `unknown` (no `available`) |
| `reconfirm` | Verificar en terreno | Cualquier estado | `lastConfirmedAt` = ahora |
| `mark_unknown` | Marcar como desconocido | Cualquier estado | Cama → `unknown` |
| `mark_available` | **PROHIBIDO** (R2) | — | Siempre `fail()` — registra intento en caja negra |

### `decide_approval` — Decidir sobre una propuesta

```json
{ "op": "decide_approval", "params": { "approvalId": 1, "decision": "approved"|"rejected", "reason": "..." } }
```

| Caso | Comportamiento |
|---|---|
| Propuesta `pending` + `approved` | Se aplica la acción correspondiente (alta→limpieza, inspección→disponible, borrador→envío) |
| Propuesta `pending` + `rejected` | Se revierte al estado previo con motivo registrado |
| Propuesta `expired` | `fail()` — "El sistema no aplica propuestas caducadas" |
| Propuesta `superseded` | `fail()` — "La condición cambió desde que se propuso" |
| Propuesta ya decidida | `fail()` — "Ya fue decidida" |

### `task` — Acciones del flujo de limpieza

```json
{ "op": "task", "params": { "taskId": 4, "taskOp": "<acción>", "reason": "..." } }
```

| taskOp | De → A | Descripción |
|---|---|---|
| `accept` | `notified` → `accepted` | Aseo tomó el trabajo |
| `start` | `accepted` → `cleaning` | Limpieza iniciada (cama → `cleaning`) |
| `finish` | `cleaning` → `pending_inspection` | Aseo informó término → crea propuesta de inspección |
| `block` | `notified\|accepted\|cleaning` → `blocked` | Impedimento informado (requiere `reason`) |
| `unblock` | `blocked` → estado anterior | Retoma sin perder marcas de tiempo |
| `cancel` | cualquiera excepto `completed\|cancelled` | Anula con motivo (cama → `occupied`) |

### `resolve_conflict` — Resolver contradicción entre fuentes

```json
{ "op": "resolve_conflict", "params": { "conflictId": 1, "winner": "A"|"B", "apply": true, "criterion": "..." } }
```

- `criterion` es obligatorio y queda guardado para aprender y capacitar.
- Si `winner` resuelve hacia `available`, se rechaza (R2).
- Al resolver, la automatización vuelve a operar sobre esa cama.

---

## Operaciones de mensajería

### `draft_reply` — Preparar borrador de respuesta

```json
{ "op": "draft_reply", "params": { "messageId": 4 } }
```

Genera un borrador en Aprobaciones. El borrador se envía solo con `decide_approval("approved")`.

### `simulate_inbound` — Simular correo entrante (demo)

```json
{ "op": "simulate_inbound" }
```

Rota entre 6 escenarios: alta, solicitud, conflicto, datos faltantes, inyección (R4), administrativo.

### `simulate_retry` — Simular reintento (idempotencia)

```json
{ "op": "simulate_retry" }
```

Demuestra que el mismo mensaje no se procesa dos veces (R7).

---

## Operaciones del sistema

| op | Descripción |
|---|---|
| `capacity_query` | Responde "¿tenís cama?" con dato confirmado, vencido y en ciclo |
| `close_shift` | Genera informe de turno desde la caja negra |
| `save_setting` | `{ key, value }` — actualiza configuración en caliente |
| `reset_demo` | Reinicia todos los datos ficticios (solo demo) |
| `ping` | Ejecuta mantenimiento perezoso y retorna "Sistema operativo" |

---

## Códigos de error comunes

| Mensaje contiene | Regla | Significado |
|---|---|---|
| "Bloqueado por R2" | R2 | Intento de marcar disponible sin inspección humana |
| "conflicto abierto" | R3 | La cama tiene una contradicción sin resolver |
| "ya venció" | R1 | Propuesta caducada, no se aplica |
| "quedó obsoleta" | R1 | La condición cambió desde que se propuso |
| "flujo no se salta etapas" | — | Operación de tarea fuera de secuencia |
| "MODO DEGRADADO" | R11 | Error del sistema — la hoja sigue operativa |
