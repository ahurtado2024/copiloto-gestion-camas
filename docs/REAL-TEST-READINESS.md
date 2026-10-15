# CUÁNDO PASAR A ENTORNO REAL DE PRUEBAS

> Documento de criterio ejecutivo y técnico.
> Objetivo: definir **en qué momento** este proyecto debe salir del sandbox y pasar a un stack real de trabajo (GitHub + Cursor + Supabase + Vercel), y **cuándo NO**.

---

## Respuesta corta

### Sí conviene pasar **ya** a un entorno real de desarrollo/staging si:
- la arquitectura base ya está clara,
- el modelo de datos principal ya existe,
- las reglas de negocio críticas ya están codificadas,
- y el proyecto necesita continuidad, versionado, despliegue compartido y pruebas acumulativas.

### No conviene pasar **todavía** a un piloto real con usuarios/operación si falta cualquiera de estos 5:
1. **auth/roles**,
2. **integración real de canales** (correo / Telegram / hoja),
3. **tests automáticos de invariantes R1–R12**,
4. **observabilidad y trazas de error**,
5. **línea base real del proceso manual**.

---

## La decisión correcta no es binaria

No existe un solo “traspaso”. Hay **3 movimientos distintos**:

### M1 · Pasar a un stack real de desarrollo
**Herramientas:** GitHub + Cursor + Vercel Preview + Supabase dev

**Mi criterio:**
> **Esto sí debe ocurrir ahora o muy pronto.**

¿Por qué?
- El proyecto ya dejó de ser una idea aislada.
- Ya existe un motor, un esquema, una UI interconectada, documentación y criterios de validación.
- A partir de este punto, el mayor riesgo ya no es “si la idea se entiende”, sino **perder trazabilidad, continuidad y disciplina de release**.

**Objetivo de M1:**
- salir del sandbox como espacio único,
- crear repositorio fuente de verdad,
- tener deploys repetibles,
- tener previews por branch,
- separar `dev / preview / staging`.

### M2 · Pasar a un staging operativo realista
**Herramientas:** Supabase proyecto staging + Vercel staging + secretos reales + GitHub Actions

**Mi criterio:**
> **Esto debe ocurrir cuando la app entre en v1.0-stable técnica.**

Señales mínimas:
- build estable,
- healthcheck completo,
- validación estricta de inputs,
- docs de arquitectura/API/datos,
- smoke tests definidos,
- estrategia de errores clara,
- datos ficticios reproducibles,
- procedimiento de rollback.

### M3 · Pasar a un piloto real con usuarios reales
**Mi criterio:**
> **Esto NO debe ocurrir todavía.**

Antes deben existir:
- autenticación,
- roles,
- auditoría por usuario real,
- integración con canales reales,
- política de incidentes,
- estrategia de soporte,
- criterio de reversión,
- y baseline del usuario real.

---

## Mi recomendación como encargado técnico

## Estado actual del proyecto
Hoy el proyecto está en:

> **v1.0-beta robusta en sandbox**
> con arquitectura válida, motor fuerte, documentación fuerte, UI avanzada,
> pero todavía sin las piezas mínimas para exponerse a operación real.

### Por tanto, recomiendo:

## ✅ Pasar ya a entorno real de desarrollo compartido
Con este stack:
- **GitHub** → repositorio fuente de verdad
- **Cursor** → IDE principal del equipo
- **Supabase (dev/staging)** → PostgreSQL gestionado + backups + logs + auth futura
- **Vercel** → despliegues preview/staging
- **GitHub Actions** → validación automática

## ⛔ No pasar aún a piloto real hospitalario
Hasta completar el “Gate de salida a pilotaje”.

---

# GATES DE MADUREZ

## Gate A · Salida del sandbox a stack real de desarrollo
### Recomendación: **AHORA**

### Criterios mínimos (cumplidos o casi cumplidos)
- [x] Modelo de datos principal definido
- [x] Motor de negocio principal implementado
- [x] Reglas R1–R12 codificadas
- [x] Rutas principales funcionando
- [x] Build y arranque pasan
- [x] Documentación de arquitectura/API/datos existe
- [x] Hay un seed reproducible
- [x] Hay healthcheck

### Riesgo de no mover ahora
- pérdida de disciplina de versionado,
- cambios grandes sin historial claro,
- dificultad para colaborar,
- dependencia excesiva del sandbox.

### Conclusión
> **Pasar a GitHub + Vercel + Supabase dev/staging ya es correcto.**

---

## Gate B · Entrada a staging realista
### Recomendación: **en la siguiente iteración corta**

### Requisitos mínimos
- [ ] tests automáticos del motor (al menos reglas R1, R2, R3, R4, R7, R11)
- [ ] auth básica
- [ ] roles mínimos (`encargada`, `aseo`, `jefatura`)
- [ ] secrets reales en entorno seguro
- [ ] logs de errores centralizados
- [ ] estrategia de rollback
- [ ] GitHub Actions ejecutando typegen + tsc + build
- [ ] guía de despliegue confirmada por un tercero

### Conclusión
> **No bloquear GitHub/Vercel/Supabase por esto.**
> Pero sí bloquear el “uso serio” hasta cumplirlo.

---

## Gate C · Entrada a piloto real
### Recomendación: **todavía no**

### Requisitos no negociables
- [ ] línea base manual real cargada (`METRICAS-BASE.md`)
- [ ] Gmail real o canal real integrado
- [ ] Telegram real o canal real de aseo integrado
- [ ] política de retención de registros definida
- [ ] política de acceso por establecimiento definida
- [ ] plan de incidentes definido
- [ ] procedimiento de fallback a la hoja ensayado
- [ ] usuario dueño del piloto nombrado
- [ ] criterios de reversión acordados

### Conclusión
> El piloto real se habilita cuando el sistema deja de ser solo una gran demo y pasa a tener **operación, soporte, identidad y reversión**.

---

# Stack recomendado por fase

## Fase 1 · Real-dev (ahora)
- **GitHub**: repo principal
- **Cursor**: desarrollo diario
- **Supabase DEV**: base de datos dev
- **Vercel Preview**: deploy por branch/PR
- **Vercel Staging**: rama `main` o `staging`

## Fase 2 · Pre-piloto
- **Supabase STAGING** separado de DEV
- **Vercel STAGING** con variables reales de prueba
- **GitHub Actions** con validación obligatoria
- **Sentry/Logtail/Axiom** para errores

## Fase 3 · Piloto
- **Supabase PROD/PILOT** aislado
- **Vercel PROD/PILOT** aislado
- **dominio privado o access protection**
- **auth real**
- **RLS / permisos por rol**

---

# Mi decisión concreta

## Lo que yo haría ahora mismo

### Inmediato (sí)
1. Crear repo en GitHub.
2. Subir el proyecto completo.
3. Crear proyecto Supabase DEV.
4. Migrar la DB local a Supabase DEV.
5. Crear proyecto Vercel conectado al repo.
6. Configurar variables de entorno DEV.
7. Habilitar deploy preview por branch.
8. Crear guía exacta de actualización.

### Próxima iteración (antes de piloto)
1. Auth básica.
2. Roles.
3. Tests del motor.
4. Logging estructurado.
5. Integración real de al menos un canal.

### Más adelante (recién ahí piloto)
1. Baseline real del usuario.
2. Pilotaje acotado por unidad/turno.
3. Fallback ensayado.
4. Monitoreo operativo.

---

# Señal práctica para decidir

Si la pregunta es:

## “¿Debemos sacar esto del sandbox?”
**Sí. Ahora.**

## “¿Debemos meter usuarios reales operando camas?”
**Todavía no.**

---

# Resumen ejecutivo final

### Mi recomendación oficial
- **Mover ahora a GitHub + Cursor + Supabase + Vercel como stack real de desarrollo/staging.**
- **No usar todavía como piloto real operativo** hasta cerrar auth, roles, tests, integraciones y baseline.

### Frase guía
> **El proyecto ya está listo para salir del sandbox como producto de ingeniería.**
> **Aún no está listo para entrar al hospital como sistema operativo real.**
