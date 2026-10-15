# ESTRATEGIA DE TESTING

> Objetivo: probar que las reglas innegociables se cumplen siempre,
> que el ciclo canónico funciona de punta a punta, y que los errores
> producen el comportamiento documentado.

---

## Niveles de testing

### Nivel 1: Invariantes del motor (reglas R1–R12)

Cada regla tiene al menos un test que intenta violarla y verifica que el sistema se niega:

| Test | Regla | Qué hace | Resultado esperado |
|---|---|---|---|
| `R2-block-direct-available` | R2 | Intenta `mark_available` en cama en limpieza | `fail()` + evento `escritura_bloqueada` |
| `R2-conflict-resolve-to-available` | R2 | Resuelve conflicto hacia "available" | `fail()` — R2 dentro de conflictos |
| `R3-frozen-write` | R3 | Intenta `propose_discharge` en cama con conflicto abierto | `fail()` + evento `escritura_bloqueada` |
| `R4-injection-neutralized` | R4 | Envía correo con instrucción maliciosa | Se registra, nada cambia, evento `instruccion_externa_bloqueada` |
| `R7-idempotent-message` | R7 | Reintenta el mismo mensaje | Registra duplicidad, no acciona dos veces |
| `R7-idempotent-event` | R7 | Inserta evento con mismo `dedupeKey` | `ON CONFLICT DO NOTHING` |
| `R1-expired-approval` | R1 | Aprueba propuesta vencida | `fail()` — no se aplica |
| `R1-superseded-approval` | R1 | Aprueba propuesta cuya cama cambió | `fail()` — obsoleta |
| `R6-append-only` | R6 | Verifica que no existe UPDATE/DELETE en `events` | Revisión de código |

### Nivel 2: Ciclo canónico (flujo completo)

| Test | Flujo | Verificaciones |
|---|---|---|
| `full-cycle-happy-path` | occupied → alta detectada → confirmada → limpieza creada+notificada → aceptada → iniciada → terminada → inspección aprobada → available | Todos los timestamps poblados, M1 y M2 calculados, 0 errores |
| `full-cycle-with-rejection` | ... → inspección rechazada → vuelve a cleaning | Cama NO queda available, tarea vuelve a cleaning |
| `full-cycle-with-cancellation` | ... → tarea anulada | Cama vuelve a occupied, tarea cancelled con motivo |
| `full-cycle-with-block` | ... → impedimento → retoma | Marcas de tiempo preservadas, tarea vuelve al estado previo |
| `full-cycle-with-expiry` | Alta detectada → nadie confirma → vence | Cama vuelve a occupied, propuesta `expired` |

### Nivel 3: Escenarios de bandeja

| Test | Escenario | Verificaciones |
|---|---|---|
| `inbox-alta` | Correo de alta → vinculación → propuesta | Mensaje vinculado a cama, propuesta creada, evento registrado |
| `inbox-solicitud` | Solicitud de cama → borrador | Borrador con disponibilidad verificable |
| `inbox-conflicto` | Correo contradictorio | Conflicto abierto, escritura congelada |
| `inbox-faltan-datos` | Mensaje ambiguo | Status `pendiente_datos`, R5 cumplido |
| `inbox-inyeccion` | Correo malicioso | `instruccion_externa_bloqueada`, nada cambia |

### Nivel 4: Métricas y mantenimiento

| Test | Qué verifica |
|---|---|
| `metrics-m1-calculation` | M1 = notifiedAt - detectedAt para ciclos completados |
| `metrics-m6-always-zero` | M6 (escrituras no autorizadas) = 0 siempre |
| `maintenance-expire-approvals` | Propuestas vencidas se anulan automáticamente |
| `maintenance-escalate-tasks` | Tareas sin aceptación superan SLA → prioridad sube |
| `maintenance-stale-beds` | Dato vencido genera evento `dato_vencido` |

### Nivel 5: Validación de inputs

| Test | Input | Resultado esperado |
|---|---|---|
| `validate-missing-op` | `{ }` | "Falta el campo op" |
| `validate-invalid-bed-op` | `{ bedOp: "fly" }` | "debe ser uno de: ..." |
| `validate-non-numeric-id` | `{ approvalId: "abc" }` | "entero positivo" |
| `validate-empty-criterion` | `{ criterion: "" }` | "criterio obligatorio" |

---

## Ejecución actual

Los tests se ejecutan contra la API en vivo usando `curl` desde scripts de validación. Para v1.0-stable, se migrará a un framework de testing (Vitest) con la BD en un contenedor.

## Smoke tests automatizados (actuales)

```bash
# R2: debe negarse
curl -s -X POST /api/ops -d '{"op":"bed","params":{"bedId":14,"bedOp":"mark_available"}}'
# → ok: false, "Bloqueado por R2"

# Propuesta vencida: debe negarse
curl -s -X POST /api/ops -d '{"op":"decide_approval","params":{"approvalId":5,"decision":"approved"}}'
# → ok: false, "ya venció"

# Idempotencia
curl -s -X POST /api/ops -d '{"op":"simulate_retry"}'
# → ok: true, "Duplicado ignorado"

# Ciclo completo
# 1. Confirmar alta → 2. Aceptar → 3. Iniciar → 4. Terminar → 5. Inspección OK
# Verificar: cama = available, task = completed, M1/M2 calculados
```

---

## Cobertura objetivo para v1.0-stable

| Nivel | Tests | Estado |
|---|---|---|
| Invariantes R1-R12 | 9+ | ✅ probados manualmente, pendiente Vitest |
| Ciclo canónico | 5 | ✅ probados manualmente |
| Escenarios de bandeja | 5 | ✅ probados manualmente |
| Métricas y mantenimiento | 4 | ✅ probados manualmente |
| Validación de inputs | 4+ | ✅ implementados en validate.ts |
