# PLAYBOOK DE TRASPASO Y ACTUALIZACIÓN

> Guía detallada paso a paso para mover este proyecto a un entorno real:
> **GitHub + Cursor + Supabase + Vercel**

---

# 0. Objetivo del playbook

Este documento resuelve dos cosas:

1. **Cómo traspasar** el proyecto desde este entorno al stack real
2. **Cómo seguir actualizándolo** de forma segura después

---

# 1. Arquitectura objetivo del entorno real

## Recomendación inicial

### Repositorio
- **GitHub**
  - rama `main`
  - rama `develop` (opcional, si habrá equipo)
  - branches por feature: `feat/...`, `fix/...`, `docs/...`

### App hosting
- **Vercel**
  - `Preview` por branch / PR
  - `Staging` sobre `main` (o rama `staging`)
  - `Production/Pilot` más adelante

### Base de datos
- **Supabase**
  - proyecto `copiloto-camas-dev`
  - proyecto `copiloto-camas-staging`
  - proyecto `copiloto-camas-pilot` (más adelante)

### IDE / desarrollo
- **Cursor**
  - workspace con reglas del proyecto
  - acceso al repo GitHub
  - uso diario del equipo

### Observabilidad (recomendado)
- **Sentry** o equivalente
- logs de Vercel
- logs de Supabase

---

# 2. Momento correcto para hacer el traspaso

## Recomendación
Hacer el traspaso **ahora** para desarrollo/staging.

## No esperar a tener “todo listo”
Si esperas a tener auth, integraciones reales, piloto, etc., el costo del traspaso sube.

El mejor momento es cuando:
- el modelo de datos ya es reconocible,
- el motor ya existe,
- hay build reproducible,
- hay documentación base,
- y el proyecto necesita continuidad.

**Ese momento ya llegó.**

---

# 3. Preparación antes del traspaso

## Checklist previo
- [x] Build pasa
- [x] `typegen` pasa
- [x] `tsc` pasa
- [x] Healthcheck existe
- [x] Seed reproducible existe
- [x] Docs base existen
- [x] Variables de entorno identificadas

## Variables actuales
Revisar al menos:
- `DATABASE_URL`
- futuros secretos reales (Gmail / Telegram / auth)

---

# 4. Paso a paso — mover a GitHub

## 4.1 Crear repositorio
En GitHub:
1. Crear repo nuevo, por ejemplo:
   - `copiloto-gestion-camas`
2. Marcar como privado
3. No inicializar con README si vas a subir el proyecto actual completo

## 4.2 Subir el código
Desde el proyecto local:

```bash
git init
git add .
git commit -m "chore: bootstrap copiloto gestion camas"
git branch -M main
git remote add origin git@github.com:TU-ORG/copiloto-gestion-camas.git
git push -u origin main
```

## 4.3 Crear `.gitignore`
Asegurarse de ignorar:

```gitignore
node_modules
.next
.env
.env.local
.vercel
coverage
*.log
```

---

# 5. Paso a paso — abrir en Cursor

## 5.1 Clonar repo
```bash
git clone git@github.com:TU-ORG/copiloto-gestion-camas.git
cd copiloto-gestion-camas
```

## 5.2 Abrir en Cursor
- File → Open Folder
- seleccionar el repo

## 5.3 Configurar reglas de trabajo en Cursor
Recomendado:
- usar el `HANDOFF` como contexto de negocio
- usar `docs/ARCHITECTURE.md` como contexto técnico
- usar `docs/API-REFERENCE.md` para no romper contratos

## 5.4 Crear archivo de reglas internas del workspace (recomendado)
Ejemplo sugerido en Cursor:
- no romper R1–R12
- no meter datos clínicos
- no crear camino alterno a `available`
- toda mutación pasa por `/api/ops`

---

# 6. Paso a paso — mover la base de datos a Supabase

## 6.1 Crear proyecto DEV en Supabase
1. Crear nuevo proyecto
2. Guardar:
   - Project URL
   - DB password
   - Connection string

## 6.2 Configurar variables de base de datos
Usar 2 URLs distintas en Supabase:

```env
# Runtime app (Vercel / Next.js serverless) → pooler transaction mode
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@[POOLER-HOST]:6543/postgres

# Migraciones / drizzle push → direct connection
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

## 6.3 Aplicar el esquema
Como este proyecto ya usa Drizzle:

```bash
npx drizzle-kit push
```

## 6.4 Cargar seed
```bash
npx tsx scripts/seed.ts
```

## 6.5 Verificar
```bash
curl http://localhost:3000/api/health
```
Debe devolver:
- `database: true`
- `schema: true`
- `config: true`
- `audit_log: true`

---

# 7. Paso a paso — desplegar en Vercel

## 7.1 Crear proyecto en Vercel
1. Import Project
2. Seleccionar repo GitHub
3. Framework detectado: Next.js

## 7.2 Configurar variables de entorno en Vercel
Agregar al menos:
- `DATABASE_URL`

Más adelante:
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `NEXTAUTH_SECRET`
- etc.

## 7.3 Deploy inicial
Vercel hará:
- install
- build
- deploy

## 7.4 Verificar deploy
Revisar:
- `/`
- `/api/health`
- `/ajustes/docs`

---

# 8. Estrategia de entornos recomendada

## DEV
Uso:
- desarrollo diario
- cambios de esquema frecuentes
- seed libre

## STAGING
Uso:
- demo interna
- prueba de release
- smoke tests manuales

## PILOT / PROD
Uso:
- piloto real con usuarios
- acceso restringido
- auth obligatorio
- monitoreo activo

---

# 9. Flujo de actualización posterior

## Flujo recomendado simple

### Paso 1 · Crear branch
```bash
git checkout -b feat/nombre-del-cambio
```

### Paso 2 · Desarrollar
- programar en Cursor
- correr validación local

### Paso 3 · Validar antes de push
```bash
npx next typegen
npm exec tsc -- --noEmit --pretty false
npm run build
```

### Paso 4 · Push
```bash
git add .
git commit -m "feat: descripcion"
git push origin feat/nombre-del-cambio
```

### Paso 5 · Preview en Vercel
- Vercel crea preview deploy automáticamente
- probar UI, health, flujo afectado

### Paso 6 · Merge a main
- cuando pase revisión y validación

### Paso 7 · Vercel despliega staging/main
- probar healthcheck
- probar smoke tests críticos

---

# 10. Procedimiento de actualización de esquema

## Regla
Nunca cambiar la estructura en staging/pilot sin probar antes en dev.

## Flujo
1. editar `src/db/schema.ts`
2. validar localmente
3. aplicar en DEV:
   ```bash
   npx drizzle-kit push
   ```
4. re-seed si hace falta
5. probar UI y `/api/health`
6. merge
7. aplicar en STAGING
8. volver a correr smoke tests

---

# 11. Smoke tests mínimos después de cada deploy

## Siempre probar
1. `GET /api/health`
2. abrir `/`
3. abrir `/camas/C-304`
4. abrir `/bandeja/1`
5. abrir `/limpieza/LMP-...`
6. ejecutar una validación R2:
   - intentar marcar disponible directo
7. ejecutar una validación de input inválido:
   - `bedOp=fly`

## Resultado esperado
- health OK
- rutas 200
- R2 se niega
- input inválido responde con `VALIDATION_ERROR`

---

# 12. Recomendaciones de GitHub Actions

Crear workflow `ci.yml` con:

```yaml
- npm ci
- npx next typegen
- npm exec tsc -- --noEmit --pretty false
- npm run build
```

## Más adelante
Agregar:
- tests del motor
- lint si se desea
- smoke de health en preview

---

# 13. Recomendaciones de protección de ramas

## `main`
- requerir PR
- requerir checks verdes
- bloquear push directo
- requerir al menos 1 revisión si hay equipo

---

# 14. Qué NO hacer al traspasar

- No usar la misma base para dev y piloto
- No guardar secretos en el repo
- No usar datos reales de pacientes para probar
- No saltear staging y saltar directo a piloto
- No meter auth al final: planificarla antes del piloto

---

# 15. Orden recomendado real de traspaso

## Semana 1
1. GitHub
2. Cursor
3. Supabase DEV
4. Vercel Preview/Staging
5. GitHub Actions básicas

## Semana 2
1. auth básica
2. roles
3. logs / observabilidad
4. tests del motor

## Semana 3+
1. integración Gmail/Telegram
2. baseline real
3. staging operativo realista
4. recién ahí piloto

---

# 16. Resumen ejecutivo

## Qué recomiendo hacer ya
- mover el código a GitHub
- abrir el repo en Cursor
- crear Supabase DEV/STAGING
- desplegar en Vercel
- dejar listo el circuito de actualización por branch/preview/merge

## Qué no recomiendo hacer todavía
- usarlo ya con operación hospitalaria real
- exponerlo a usuarios sin auth y roles
- mezclar dev con piloto

## Frase guía
> **Primero profesionalizar el delivery.**
> **Después pilotear la operación.**
