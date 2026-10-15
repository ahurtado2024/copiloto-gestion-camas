# MANEJO DE ERRORES

> Principio: el sistema nunca deja al humano sin salida (R11).
> Todo error se clasifica, registra en la caja negra y retorna con contexto.

---

## Clasificación de errores (ErrorCode)

| Código | Tipo | HTTP | Acción del sistema |
|---|---|---|---|
| `VALIDATION_ERROR` | Input inválido | 200 | Rechaza con mensaje claro, no registra en caja negra |
| `NOT_FOUND` | Entidad no existe | 200 | Rechaza con "no encontrado" |
| `PRECONDITION_FAILED` | Estado no permite la operación | 200 | Rechaza con explicación del estado actual |
| `CONFLICT_BLOCKED` | Conflicto abierto sobre la cama (R3) | 200 | Rechaza + registra `escritura_bloqueada` en caja negra |
| `RULE_VIOLATION` | Regla innegociable violada (R1-R12) | 200 | Rechaza + registra en caja negra + explica la regla |
| `EXPIRED` | Propuesta caducada | 200 | Rechaza con "no se aplican propuestas caducadas" |
| `SUPERSEDED` | Condición cambió | 200 | Rechaza con "dato viejo sobre estado nuevo" |
| `DUPLICATE` | Idempotencia (R7) | 200 | Ignora el efecto, registra la duplicidad |
| `SYSTEM_ERROR` | Error interno | 200 | Modo degradado: la hoja sigue operativa |
| `DEGRADED_MODE` | Sistema no disponible | 200 | Mensaje de modo degradado (R11) |

## ¿Por qué siempre HTTP 200?

Porque el cliente (Client Component) muestra toasts con el contenido de la respuesta. Un 500 rompe el flujo del usuario sin darle información útil. El campo `ok: false` + `tone: "error"` es la señal de error. El campo `code` (cuando existe) permite automatización futura.

## Capas de protección

```
1. CAPA DE VALIDACIÓN (validate.ts)
   └─ Sanitiza tipos, rangos, opciones permitidas
   └─ Lanza OperationalError antes de tocar la BD

2. CAPA DEL MOTOR (engine.ts)
   └─ Verifica precondiciones de estado
   └─ Verifica conflictos abiertos
   └─ Verifica vencimiento/obsolescencia
   └─ Registra en caja negra cada decisión

3. CAPA DE API (route.ts)
   └─ try/catch global → toDegradedResponse()
   └─ OperationalError → respuesta con código
   └─ Excepción no controlada → modo degradado (R11)
```

## Escenarios probados

| Escenario | Error esperado | Verificado |
|---|---|---|
| Aprobar propuesta vencida | `EXPIRED` — "no se aplica" | ✅ |
| Aprobar propuesta obsoleta | `SUPERSEDED` — "condición cambió" | ✅ |
| Marcar disponible sin inspección | `RULE_VIOLATION` (R2) — registra intento | ✅ |
| Operar cama con conflicto abierto | `CONFLICT_BLOCKED` (R3) — congelada | ✅ |
| Correo con instrucción al sistema | `instruccion_externa_bloqueada` (R4) — nada cambia | ✅ |
| Reintento de mensaje idéntico | `DUPLICATE` (R7) — no se acciona dos veces | ✅ |
| Sistema caído | `DEGRADED_MODE` (R11) — hoja sigue | ✅ por construcción |
| bedOp inexistente | `VALIDATION_ERROR` — "debe ser uno de:" | ✅ |
| approvalId no numérico | `VALIDATION_ERROR` — "entero positivo" | ✅ |
| op vacío | `VALIDATION_ERROR` — "falta el campo op" | ✅ |

## Registros en la caja negra

Los siguientes errores operativos generan un registro append-only en `events`:

- `escritura_bloqueada` — intento de escribir sobre cama con conflicto
- `instruccion_externa_bloqueada` — correo tratando de ordenar al sistema (R4)
- `aprobacion_vencida` — propuesta que caducó sin decisión
- `aprobacion_obsoleta` — condición cambió antes de decidir
- `limpieza_escalada` — aviso sin aceptación superó el SLA

Los errores de validación de input (tipo incorrecto, rango fuera) **no** se registran en la caja negra porque no representan un evento operativo.
