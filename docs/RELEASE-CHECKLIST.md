# CHECKLIST DE RELEASE

> Ejecutar antes de cada merge a `main` o `staging`.
> Marca cada ítem. Si alguno falla, no se mergea.

---

## Antes del PR

### Código
- [ ] `npm run check` pasa limpio (`typegen` + `tsc` + `build`)
- [ ] `npm run lint` sin errores (warnings aceptados)
- [ ] No hay console.log, debugger, TODO críticos en el PR
- [ ] Las reglas R1–R12 no fueron alteradas sin justificación explícita en el PR
- [ ] Si hubo cambios en `src/db/schema.ts` → `npx drizzle-kit push` en DEV y verificado

### Pull Request
- [ ] Título claro: `feat:` / `fix:` / `docs:` / `chore:` + descripción
- [ ] Descripción dice QUÉ cambia y POR QUÉ
- [ ] Vercel Preview creado y probado (abrir la URL del Preview)
- [ ] Los smoke tests críticos se corrieron en el Preview

---

## Smoke tests en Preview / Staging

### Siempre
- [ ] `GET /api/health` devuelve `{"ok":true, "checks": {...}}`
- [ ] `/` carga el tablero
- [ ] `/camas/C-304` carga el detalle de cama
- [ ] `/ajustes/hoja` carga la integración con la hoja

### Invariantes del motor
- [ ] R2: `POST /api/ops {"op":"bed","params":{"bedId":11,"bedOp":"mark_available"}}` → `ok:false` + "R2"
- [ ] Input inválido: `{"op":"bed","params":{"bedId":1,"bedOp":"volar"}}` → `VALIDATION_ERROR`
- [ ] Health: `{"ok":true,"checks":{"database":true,"schema":true,"config":true,"audit_log":true}}`

### Si el PR tocó el motor (engine.ts)
- [ ] El ciclo completo alta→limpieza→inspección→disponible funciona
- [ ] Una propuesta vencida no se puede aprobar
- [ ] Conflicto abierto congela la cama

### Si el PR tocó el schema (schema.ts)
- [ ] `drizzle-kit push` se aplicó en DEV
- [ ] El seed corre sin errores
- [ ] Health devuelve `schema: true`

---

## Después del merge a main

- [ ] Vercel staging deploy verde
- [ ] Smoke tests en staging
- [ ] Verificar que la caja negra tiene el evento del último cambio
- [ ] Si hubo cambios de config → probar en `/ajustes` que se guarden

---

## Antes del primer piloto (Gate C)

- [ ] Auth implementada y probada
- [ ] Roles funcionando
- [ ] Logs centralizados activos (Sentry o equivalente)
- [ ] Baseline del usuario cargada (`docs/METRICAS-BASE.md`)
- [ ] Plan de incidentes redactado
- [ ] Fallback a la hoja ensayado
- [ ] Retención de datos definida
- [ ] Usuario dueño del piloto nombrado
