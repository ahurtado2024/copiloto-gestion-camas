# ROADMAP — Copiloto de Gestión de Camas

> Estado: **v1.0-beta** · Fecha de corte: 2026-10-14
> Metodología: **Shape Up** (apuestas de 6 semanas) + **evidencia antes de expansión**

---

## Horizonte de producto

```
v1.0   Copiloto auxiliar        ← ESTAMOS AQUÍ
v1.1   Integración real (Gmail API + Telegram Bot)
v1.2   Lectura de hoja (Google Sheets API)
v2.0   Backend que reemplaza la hoja
v3.0   Interoperabilidad FHIR CL Core
```

---

## v1.0-beta — Copiloto auxiliar (actual)

### ✅ Completado
| # | Entregable | Estado |
|---|---|---|
| 1 | Modelo de datos (8 tablas, 12 estados de cama, 9 de tarea) | ✅ |
| 2 | Motor de negocio con las 12 reglas innegociables | ✅ |
| 3 | Ciclo canónico alta→limpieza→inspección→disponible | ✅ |
| 4 | Sistema de propuestas human-in-the-loop (R1) | ✅ |
| 5 | Bloqueo duro de disponibilidad por inferencia (R2) | ✅ |
| 6 | Detección y resolución de conflictos entre fuentes (R3) | ✅ |
| 7 | Neutralización de instrucciones externas (R4) | ✅ |
| 8 | Caja negra append-only con idempotencia (R6/R7) | ✅ |
| 9 | Mantenimiento perezoso (vencimientos, escalados, datos stale) | ✅ |
| 10 | 15 rutas funcionales incluyendo detalle de cama/tarea/mensaje | ✅ |
| 11 | Métricas M1–M8 calculadas desde la caja negra | ✅ |
| 12 | Cierre de turno automático con exportación | ✅ |
| 13 | Configuración en caliente de umbrales operativos | ✅ |
| 14 | Simulador de bandeja (6 escenarios) con idempotencia | ✅ |

### 🔲 Pendiente para v1.0-stable
| # | Tarea | Prioridad | Bloqueante |
|---|---|---|---|
| P1 | Suite de tests E2E del motor (reglas R1–R12) | 🔴 ALTA | No |
| P2 | Validación estricta de inputs en API `/api/ops` | 🔴 ALTA | No |
| P3 | Manejo de errores estructurado (códigos, retry) | 🔴 ALTA | No |
| P4 | Documentación de API (contratos request/response) | 🟡 MEDIA | No |
| P5 | Llenar línea base con el usuario (METRICAS-BASE.md) | 🔴 ALTA | Sí (usuario) |
| P6 | Prueba de carga: 200 camas, 1000 eventos | 🟡 MEDIA | No |
| P7 | Revisión de seguridad (RLS, sanitización) | 🟡 MEDIA | No |

---

## v1.1 — Integración real (apuesta de 6 semanas)

| # | Entregable | Dependencia |
|---|---|---|
| I1 | Gmail API: lectura de correo con OAuth2, clasificación real | API key configurada |
| I2 | Telegram Bot: canal de interacción del turno | Bot token |
| I3 | Webhook entrante: correo → clasificación → propuesta | I1 |
| I4 | Notificaciones proactivas a Telegram (UC-04) | I2 |
| I5 | Acuse de recibo automático configurable | I1 |

**Criterio de paso:** el copiloto lee correo real y avisa por Telegram sin intervención manual, con 0 escrituras no autorizadas en 2 semanas.

---

## v1.2 — Lectura de hoja (apuesta de 4 semanas)

| # | Entregable | Dependencia |
|---|---|---|
| H1 | Google Sheets API: lectura periódica (polling o cambios) | Service account |
| H2 | Detección de contradicciones hoja vs. registro paralelo | H1 |
| H3 | Propuesta de sincronización (nunca escritura automática en MVP) | H2 |

**Criterio de paso:** el registro paralelo coincide con la hoja ≥95% del tiempo; conflictos detectados ≥80%.

---

## v2.0 — Backend que reemplaza la hoja (apuesta de 8 semanas)

| # | Entregable | Condición previa |
|---|---|---|
| B1 | Vista por unidad y turno con la misma velocidad de edición | v1.2 estable |
| B2 | Edición directa de camas (misma UX que la hoja) | B1 |
| B3 | Escritura controlada hacia la hoja (fase de transición) | B2 |
| B4 | Generación de informes listos para el software oficial | B3 |
| B5 | Retiro gradual de la hoja (por gravedad, no por decreto) | Adopción medida |

**Criterio de paso:** el usuario elige el sistema sobre la hoja ≥3 turnos consecutivos sin que nadie le insista.

---

## v3.0 — Interoperabilidad FHIR CL Core

| # | Entregable | Referencia |
|---|---|---|
| F1 | Mapeo a HL7 FHIR R4 con perfil CL Core (Location/Slot) | Ley 21.668 |
| F2 | API FHIR para consulta de capacidad | F1 |
| F3 | Lectura/escritura desde/hacia el software oficial | F2 |

---

## Criterios transversales (aplican a toda versión)

1. **Cero escrituras no autorizadas** — métrica M6, siempre 0 por construcción
2. **El sistema nunca es punto único de fallo** — la hoja sigue viva (R11)
3. **Sin datos clínicos** — minimización por diseño (R12)
4. **Todo queda registrado** — la caja negra crece, nunca se edita (R6)
5. **El usuario puede decir "no quiero esto"** — reversión sin drama, causa registrada
