# RUNBOOK DE TRASPASO — Manual de ejecución supervisado

> **Qué es este documento:** la guía exacta, paso a paso, para mover el proyecto
> del sandbox de desarrollo al entorno real con GitHub + Cursor + Supabase + Vercel.
>
> **Cómo usarlo:** seguir en orden. No saltar etapas. Cada paso tiene una verificación
> que dice "esperado" — si no se cumple, no avanzar.
>
> **Duración estimada:** 45–90 minutos la primera vez.
>
> **Requisitos previos:**
> - Cuenta de GitHub (con acceso a crear repos privados)
> - Cuenta de Supabase (plan Free es suficiente para empezar)
> - Cuenta de Vercel (plan Hobby es suficiente para empezar)
> - Cursor instalado en tu computador
> - Node.js 22+ instalado (`node -v` para verificar)
> - Git instalado (`git --version` para verificar)

---

# ETAPA 1 · GITHUB — Crear el repositorio

## Contexto
GitHub será la **fuente de verdad del código**. Todo cambio futuro pasa por aquí.
Vercel lee de aquí para hacer deploys. GitHub Actions corren CI desde aquí.

## Paso 1.1 — Crear el repositorio en GitHub

1. Abrir **github.com** → hacer login
2. Click en el botón verde **"New"** (o ir a github.com/new)
3. Llenar:
   - **Repository name:** `copiloto-gestion-camas`
   - **Description:** `Copiloto de gestión de camas — Red O'Higgins`
   - **Visibility:** seleccionar **Private**
   - **NO** marcar "Add a README" (ya tenemos uno)
   - **NO** marcar "Add .gitignore" (ya tenemos uno)
4. Click en **"Create repository"**
5. GitHub te mostrará una página con instrucciones. **No cerrar esta pestaña** — necesitarás la URL del repo.

### ✅ Verificación
- Tienes un repo vacío en `github.com/TU-USUARIO/copiloto-gestion-camas`
- La URL se ve como: `https://github.com/TU-USUARIO/copiloto-gestion-camas`

---

## Paso 1.2 — Descargar el proyecto desde este sandbox

El proyecto completo que hemos construido necesita salir de este entorno.

**Opción A — Si tienes acceso directo a los archivos del sandbox:**
1. Descargar todo el proyecto como ZIP o carpeta
2. Descomprimirlo en tu computador
3. Nombrar la carpeta `copiloto-gestion-camas`

**Opción B — Si usas la terminal del sandbox:**
Puedes copiar los archivos relevantes. El proyecto no pesa mucho — son ~50 archivos de código y documentación.

### ✅ Verificación
En tu computador tienes una carpeta `copiloto-gestion-camas` con estos archivos:
```
copiloto-gestion-camas/
├── README.md
├── AGENTS.md
├── .gitignore
├── .env.example
├── .nvmrc
├── package.json
├── vercel.json
├── drizzle.config.ts
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── scripts/
│   └── seed.ts
├── src/
│   ├── env.ts
│   ├── db/
│   ├── lib/
│   ├── components/
│   └── app/
├── docs/
│   └── (14+ archivos .md)
├── .cursor/
│   └── rules/ (4 archivos .mdc)
└── .github/
    └── workflows/ci.yml
```

---

## Paso 1.3 — Subir el proyecto a GitHub

Abrir terminal en la carpeta del proyecto:

```bash
cd copiloto-gestion-camas
```

Ejecutar estos comandos **uno por uno**:

```bash
# 1. Inicializar git
git init

# 2. Agregar todos los archivos
git add .

# 3. Primer commit
git commit -m "chore(repo): bootstrap copiloto gestión de camas"

# 4. Crear rama principal
git branch -M main

# 5. Conectar con tu repo de GitHub
# ⚠️ REEMPLAZAR con tu URL real del paso 1.1
git remote add origin https://github.com/TU-USUARIO/copiloto-gestion-camas.git

# 6. Subir
git push -u origin main
```

### ✅ Verificación
- Abrir `github.com/TU-USUARIO/copiloto-gestion-camas` en el navegador
- Debes ver todos los archivos: README.md, src/, docs/, etc.
- El README debe mostrarse formateado con el título "Copiloto de Gestión de Camas"

### ❌ Si falla
- **"Permission denied":** configurar SSH keys o usar HTTPS con token personal
  - GitHub → Settings → Developer settings → Personal access tokens → Generate new token
  - Usar como password cuando Git lo pida
- **"Repository not found":** verificar que la URL del remote sea correcta

---

## Paso 1.4 — Proteger la rama principal

1. En GitHub, ir al repo → **Settings** (pestaña superior)
2. En el menú izquierdo, click en **Branches**
3. Click **"Add branch ruleset"** (o "Add rule" si aparece el formato antiguo)
4. Configurar:
   - **Branch name pattern:** `main`
   - Activar: **"Require a pull request before merging"**
   - Activar: **"Require status checks to pass before merging"**
5. Click **"Create"** o **"Save changes"**

### ✅ Verificación
- Si intentas hacer `git push origin main` directo, debería rechazarse (o al menos advertir)
- Los cambios a `main` ahora requieren un Pull Request

---

# ETAPA 2 · SUPABASE — Crear la base de datos

## Contexto
Supabase será el **registro en paralelo**: respaldo, auditoría, métricas y memoria
estructurada. **La hoja del turno sigue siendo la fuente operacional primaria.**

## Paso 2.1 — Crear cuenta y proyecto en Supabase

1. Abrir **supabase.com** → hacer login (o crear cuenta con GitHub)
2. Click en **"New Project"**
3. Llenar:
   - **Organization:** seleccionar o crear una
   - **Name:** `copiloto-camas-dev`
   - **Database Password:** generar uno fuerte y **guardarlo en un lugar seguro**
     - ⚠️ **Este password lo necesitarás en los siguientes pasos. No lo pierdas.**
   - **Region:** seleccionar la más cercana a Chile (ej: `South America (São Paulo)`)
   - **Plan:** Free es suficiente para empezar
4. Click **"Create new project"**
5. **Esperar ~2 minutos** mientras Supabase aprovisiona el servidor

### ✅ Verificación
- Ves el dashboard del proyecto con el nombre `copiloto-camas-dev`
- El estado del proyecto dice "Active" (punto verde)

---

## Paso 2.2 — Obtener las 2 URLs de conexión

Supabase te da **2 URLs diferentes**. Necesitas las 2:

1. En el dashboard del proyecto, click en el botón **"Connect"** (arriba a la derecha)
2. Seleccionar la pestaña **"ORMs"** o **"Connection string"**
3. Buscar y copiar **estas 2 URLs:**

### URL 1: Transaction Pooler (para la app en Vercel)
- Buscar la que dice **"Transaction pooler"** o tiene puerto **`:6543`**
- Se ve así:
  ```
  postgresql://postgres.[tu-proyecto]:[password]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
  ```
- **Copiarla y guardarla.** Esta será tu `DATABASE_URL`.

### URL 2: Direct Connection (para migraciones)
- Buscar la que dice **"Direct connection"** o tiene puerto **`:5432`**
- Se ve así:
  ```
  postgresql://postgres:[password]@db.[tu-proyecto].supabase.co:5432/postgres
  ```
- **Copiarla y guardarla.** Esta será tu `DIRECT_URL`.

### ⚠️ Importante
- En ambas URLs, reemplazar `[YOUR-PASSWORD]` con el password que guardaste en 2.1
- Si tu password tiene caracteres especiales (`&`, `#`, `?`, `@`, espacios), necesitas codificarlos:
  - `&` → `%26`
  - `#` → `%23`
  - `?` → `%3F`
  - `@` → `%40`
  - espacio → `%20`

### ✅ Verificación
- Tienes 2 URLs guardadas
- Una tiene puerto `:6543` (pooler, para la app)
- Otra tiene puerto `:5432` (directa, para migraciones)
- Ambas tienen tu password real (no `[YOUR-PASSWORD]`)

---

## Paso 2.3 — Configurar el archivo de entorno local

En la carpeta del proyecto en tu computador:

```bash
# Crear el archivo de entorno local (copiando el ejemplo)
cp .env.example .env.local
```

Abrir `.env.local` en cualquier editor y **editar estas 3 líneas:**

```env
# Pegar la URL del transaction pooler (la del puerto 6543)
DATABASE_URL=postgresql://postgres.TU-PROYECTO:TU-PASSWORD@aws-0-sa-east-1.pooler.supabase.com:6543/postgres

# Pegar la URL de la direct connection (la del puerto 5432)
DIRECT_URL=postgresql://postgres:TU-PASSWORD@db.TU-PROYECTO.supabase.co:5432/postgres

# Cambiar de "demo" a "dev"
APP_ENV=dev
```

**Dejar el resto como está** por ahora (Gmail, Telegram, Auth, etc. se configurarán después).

### ✅ Verificación
- El archivo `.env.local` existe en la raíz del proyecto
- Tiene `DATABASE_URL` con tu URL real del pooler
- Tiene `DIRECT_URL` con tu URL real directa
- Tiene `APP_ENV=dev`

---

## Paso 2.4 — Instalar dependencias y aplicar el esquema

En la terminal, desde la carpeta del proyecto:

```bash
# 1. Instalar dependencias
npm install
```

Esperado: no debe haber errores. Puede haber warnings — eso es normal.

```bash
# 2. Aplicar el esquema de la base de datos a Supabase
npx drizzle-kit push
```

Drizzle te preguntará si quieres aplicar los cambios. **Responder "Yes"** (o presionar Enter).

### ✅ Verificación
- El comando termina sin errores
- Dice algo como `[✓] Changes applied`
- Si abres Supabase Dashboard → **Table Editor**, debes ver las tablas:
  - `establishments`
  - `beds`
  - `cleaning_tasks`
  - `approvals`
  - `conflicts`
  - `messages`
  - `events`
  - `settings`
  - `shift_reports`

### ❌ Si falla
- **"Connection refused" o "timeout":** la URL puede estar mal copiada. Verificar que el password no tiene caracteres sin codificar.
- **"Password authentication failed":** el password en la URL no coincide con el del paso 2.1.
- **"SSL required":** agregar `?sslmode=require` al final de la DIRECT_URL.

---

## Paso 2.5 — Cargar datos de prueba

```bash
npm run seed
```

### ✅ Verificación
- Debe imprimir: `✔ Seed completo: 3 establecimientos, 32 camas, 8 tareas, 6 propuestas, 2 conflictos, 32 eventos, 7 mensajes, 7 settings.`
- En Supabase Dashboard → Table Editor → tabla `beds` → debes ver 32 filas

---

## Paso 2.6 — Probar que la app funciona con Supabase

```bash
npm run dev
```

Abrir en el navegador: **http://localhost:3000**

### ✅ Verificación completa
Abrir estas URLs una por una y verificar:

| URL | Qué debes ver |
|---|---|
| `http://localhost:3000` | El tablero con KPIs, camas en movimiento |
| `http://localhost:3000/api/health` | `{"ok":true,"checks":{"database":true,"schema":true,"config":true,"audit_log":true},...}` |
| `http://localhost:3000/camas/C-304` | Detalle de la cama C-304 con ficha, historial, acciones |
| `http://localhost:3000/ajustes/hoja` | Integración con la hoja (modo demo) |
| `http://localhost:3000/ajustes/docs` | Centro de documentación con 17+ documentos |

### ❌ Si falla
- **Página en blanco o error 500:** revisar la terminal donde corre `npm run dev` — ahí aparecerá el error real.
- **"DATABASE_URL is required":** el archivo `.env.local` no se está leyendo. Verificar que está en la raíz del proyecto y que no tiene errores de sintaxis.
- **Health dice `database: false`:** la URL de conexión no funciona. Probar con la DIRECT_URL en DATABASE_URL temporalmente para diagnosticar.

Una vez que todo funcione: **detener el servidor local** con `Ctrl+C`.

---

# ETAPA 3 · VERCEL — Desplegar la aplicación

## Contexto
Vercel será el **hosting de la aplicación**. Cada vez que hagas push a GitHub,
Vercel desplegará automáticamente. Cada PR tendrá su propia URL de preview.

## Paso 3.1 — Crear cuenta y proyecto en Vercel

1. Abrir **vercel.com** → hacer login (recomendado: con tu cuenta de GitHub)
2. Click en **"Add New..."** → **"Project"**
3. Vercel te mostrará tus repos de GitHub
4. Buscar `copiloto-gestion-camas` y click **"Import"**
5. En la pantalla de configuración:
   - **Framework Preset:** debe detectar **Next.js** automáticamente
   - **Root Directory:** dejar como está (`.`)
   - **Build Command:** dejar como está (`next build`)
   - **NO** hacer click en "Deploy" todavía — primero agregar las variables

## Paso 3.2 — Agregar variables de entorno en Vercel

En la misma pantalla de configuración (o si ya deployaste, ir a **Settings → Environment Variables**):

1. Click en **"Environment Variables"** para expandir la sección
2. Agregar **estas 2 variables:**

| Key | Value | Environments |
|---|---|---|
| `DATABASE_URL` | *pegar tu URL del pooler transaction (6543)* | ✅ Production ✅ Preview ✅ Development |
| `DIRECT_URL` | *pegar tu URL de direct connection (5432)* | ✅ Production ✅ Preview ✅ Development |

Para cada una:
- Escribir el nombre en **"Key"** (ej: `DATABASE_URL`)
- Pegar el valor en **"Value"**
- Verificar que los 3 checkboxes de entornos estén marcados
- Click **"Add"**

3. Ahora sí, click **"Deploy"**

### ✅ Verificación
- Vercel empieza a hacer el build (tarda 1-3 minutos)
- El build debe terminar en verde ✅
- Vercel te da una URL como `copiloto-gestion-camas.vercel.app`
- Abrir esa URL → debe cargar el tablero
- Abrir `[tu-url]/api/health` → debe decir `"ok": true` con 4 checks en true

### ❌ Si falla el build
- Click en el deploy fallido para ver los logs
- Buscar la primera línea roja
- Los errores más comunes:
  - **"DATABASE_URL is required":** la variable no se guardó bien. Ir a Settings → Environment Variables y verificar.
  - **TypeScript errors:** esto no debería pasar si el proyecto venía limpio del sandbox. Si pasa, revisar el log exacto.

---

## Paso 3.3 — Verificar el deploy completo

Abrir en el navegador tu URL de Vercel y probar:

| Ruta | Qué esperar |
|---|---|
| `/` | Tablero con datos |
| `/api/health` | OK con 4 checks |
| `/camas` | 32 camas |
| `/camas/C-304` | Detalle completo |
| `/limpieza` | Ciclos activos |
| `/aprobaciones` | Propuestas pendientes |
| `/bandeja` | Mensajes por canal |
| `/ajustes` | Configuración |
| `/ajustes/hoja` | Integración con la hoja (modo demo) |
| `/ajustes/docs` | Centro de documentación |

### ✅ Verificación
- Todas las rutas cargan
- El health check devuelve OK
- Los datos se ven (camas, tareas, eventos)
- Las acciones funcionan (aprobar, rechazar, simular correo)

---

# ETAPA 4 · CURSOR — Abrir el proyecto en el IDE

## Contexto
Cursor será el **IDE del equipo** para desarrollo diario. Ya viene con reglas
del proyecto que guían al agente de IA para respetar las reglas R1-R12 y la
política de fuente de verdad.

## Paso 4.1 — Clonar el repo (si no lo hiciste ya)

```bash
git clone https://github.com/TU-USUARIO/copiloto-gestion-camas.git
cd copiloto-gestion-camas
npm install
```

## Paso 4.2 — Abrir en Cursor

1. Abrir **Cursor**
2. File → **Open Folder**
3. Seleccionar la carpeta `copiloto-gestion-camas`

## Paso 4.3 — Verificar que las reglas del proyecto se cargaron

1. En Cursor, abrir **Customize** (ícono en la barra lateral)
2. Ir a **Rules**
3. Debes ver las reglas del proyecto:
   - `project-basics` (Always Apply ✅)
   - `business-rules` (Auto-attached a archivos del motor)
   - `api-and-validation` (Auto-attached a archivos de API)
   - `sheets-source-of-truth` (Auto-attached a archivos de la hoja)

### ✅ Verificación
- Cursor muestra 4 reglas del proyecto
- `project-basics` dice "Always Apply"
- Si abres `src/lib/engine.ts`, la regla `business-rules` se activa automáticamente

## Paso 4.4 — Configurar el entorno local

```bash
cp .env.example .env.local
# Editar .env.local con las URLs de Supabase (igual que en la Etapa 2)
```

## Paso 4.5 — Verificar que todo funciona desde Cursor

Abrir la terminal integrada de Cursor (Ctrl+` o Cmd+`):

```bash
npm run dev
```

Abrir http://localhost:3000 → verificar que el tablero carga con datos.

### ✅ Verificación
- La app funciona localmente desde Cursor
- Las reglas del proyecto están activas
- El agente de IA de Cursor respeta las reglas si le pides algo

---

# ETAPA 5 · GITHUB ACTIONS — Verificar el CI

## Contexto
GitHub Actions ejecuta validación automática en cada push y PR.
Ya viene configurado en `.github/workflows/ci.yml`.

## Paso 5.1 — Disparar el primer CI

El CI ya debería haberse ejecutado con el push inicial.

1. Ir a GitHub → tu repo → pestaña **"Actions"**
2. Debes ver un workflow llamado **"CI — Copiloto Gestión de Camas"**
3. Click para ver los detalles

### ✅ Verificación
- El job **"validate"** debe estar verde ✅
- Ejecutó: `typegen` → `tsc` → `build`
- El job **"smoke"** solo corre en push a `main` o `staging`

### ❌ Si falla
- Click en el job fallido para ver los logs
- Buscar el primer error
- Si dice "DATABASE_URL": el CI no necesita BD real para el build (la URL dummy es suficiente para typegen/tsc/build)

---

# ETAPA 6 · VERIFICACIÓN FINAL

## Paso 6.1 — Checklist de traspaso completado

Marcar cada ítem:

### GitHub
- [ ] Repo creado y privado
- [ ] Código subido a `main`
- [ ] README visible y formateado
- [ ] Branch protection activada en `main`
- [ ] GitHub Actions ejecutándose

### Supabase
- [ ] Proyecto `copiloto-camas-dev` creado
- [ ] Esquema aplicado (9 tablas visibles)
- [ ] Seed cargado (32 camas, datos de prueba)
- [ ] URLs de conexión guardadas de forma segura

### Vercel
- [ ] Proyecto importado desde GitHub
- [ ] `DATABASE_URL` configurada en env vars
- [ ] `DIRECT_URL` configurada en env vars
- [ ] Build exitoso (verde)
- [ ] URL pública funciona
- [ ] `/api/health` devuelve OK con 4 checks

### Cursor
- [ ] Repo clonado y abierto
- [ ] 4 reglas de proyecto visibles en Customize → Rules
- [ ] `.env.local` configurado
- [ ] `npm run dev` funciona localmente

### Prueba funcional
- [ ] El tablero muestra datos reales desde Supabase
- [ ] Aprobar/rechazar una propuesta funciona
- [ ] Simular un correo entrante funciona
- [ ] `/ajustes/hoja` muestra la integración con la hoja
- [ ] `/ajustes/docs` muestra 17+ documentos

---

# ETAPA 7 · QUÉ SIGUE DESPUÉS DEL TRASPASO

## Inmediato (esta semana)
- Hacer un cambio pequeño por PR para probar el flujo completo:
  branch → commit → push → preview → merge → deploy staging
- Familiarizarse con el dashboard de Vercel (logs, deploys)
- Explorar las tablas en Supabase Studio

## Siguiente iteración
- Conectar la hoja real del turno (Google Sheets API)
- Para eso necesitas:
  - Google Cloud Console configurado
  - Service Account creado
  - La hoja compartida con el email del service account
  - Variables `GOOGLE_SHEETS_*` en `.env.local` y Vercel

## Antes del piloto real
- Auth (Clerk o NextAuth)
- Roles (encargada, aseo, jefatura)
- Tests automáticos del motor
- Baseline real del usuario (METRICAS-BASE.md)

---

# REGLA DE ORO DEL TRASPASO

> **Si algo falla: no improvisar.**
> Detenerse, leer el error, buscar en la documentación del proyecto
> (`docs/ERROR-HANDLING.md`, `docs/STACK-GUIDE.md`), y si no se resuelve,
> registrar el error exacto para revisarlo juntos.
>
> El sistema nunca es punto único de fallo (R11).
> La hoja del turno sigue operativa siempre.
