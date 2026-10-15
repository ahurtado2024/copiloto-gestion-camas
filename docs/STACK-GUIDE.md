# GUÍA DE STACK — Herramientas y su rol

> Para este proyecto específico, con el contexto de gestión de camas
> en una red pública chilena, con Google Sheets como fuente operacional.

---

## Stack completo recomendado

### DESARROLLO Y CONTROL DE VERSIONES

#### GitHub ✅ (ahora)
**Por qué:** fuente de verdad del código, historial completo, colaboración, PR con preview, integraciones con Vercel y CI/CD.
**Configuración mínima:**
- repo privado
- rama `main` protegida
- rama `develop` para trabajo diario
- branch protection: require PR + checks verdes

#### Cursor ✅ (ahora)
**Por qué:** IDE moderno con contexto de IA que entiende el codebase completo. Permite trabajar con el HANDOFF, la arquitectura y el motor de negocio como contexto, sin perder el hilo entre sesiones.

**Hallazgo actualizado 2026:**
- Cursor recomienda **Project Rules** en `.cursor/rules/*.mdc`
- `AGENTS.md` es un complemento simple y portable para instrucciones del repo
- las reglas deben versionarse junto al código

**Configuración mínima:**
- clonar el repo
- abrir la carpeta del proyecto
- cargar `HANDOFF-NEGOCIO.md` + `docs/ARCHITECTURE.md` como contexto
- usar las reglas ya incluidas en `.cursor/rules/`
- leer `AGENTS.md` al iniciar

---

### BASE DE DATOS

#### Supabase ✅ (ahora, como registro en paralelo)
**Por qué:** PostgreSQL gestionado con backups automáticos, logs, Row Level Security (para cuando se agregue auth), Studio visual, API REST automática y dashboard de queries.

**Rol en este proyecto:**
> La hoja de cálculo sigue siendo la fuente operacional que el encargado edita.
> Supabase es el registro en paralelo: guarda todo lo que la hoja no puede —
> historia, tiempos, propuestas, conflictos, métricas.
> No compiten. Se complementan.

**3 proyectos recomendados:**
- `copiloto-camas-dev` — desarrollo
- `copiloto-camas-staging` — staging/demo
- `copiloto-camas-pilot` — piloto real (cuando llegue el momento)

**Hallazgo actualizado 2026:**
- Supabase recomienda para **serverless / edge** usar **shared pooler transaction mode**
- runtime de la app → **puerto 6543**
- migraciones / pg_dump / backup / restore → **conexión directa 5432**
- transaction mode no soporta prepared statements

**Configuración mínima:**
- `DATABASE_URL` → runtime app (pooler 6543)
- `DIRECT_URL` → migraciones / `drizzle-kit push` (5432)
- Pool mode: `Transaction` para runtime serverless Next.js
- Backups: activar en plan pro cuando sea piloto

---

### HOSTING Y DEPLOY

#### Vercel ✅ (ahora)
**Por qué:** integración nativa con Next.js, deploy automático por push, Preview URL por cada PR (permite revisar cambios sin afectar staging), variables de entorno seguras, logs en vivo, zero-config.

**Hallazgo actualizado 2026:**
- Vercel separa env vars por `development`, `preview`, `production`
- `vercel env pull .env.local` sincroniza las variables remotas al entorno local
- `vercel env run -- <cmd>` ejecuta comandos con env vars remotas sin escribirlas a disco

**Configuración mínima:**
- conectar repo GitHub
- agregar `DATABASE_URL` y `DIRECT_URL` por ambiente
- activar previews por branch
- usar Preview con Supabase STAGING o DEV controlado, nunca con PILOT

---

### INTEGRACIÓN CON LA HOJA DEL TURNO

#### Google Sheets API ⏳ (v1.2)
**Por qué:** la hoja es el instrumento actual del equipo. No la reemplazamos — la leemos.

**Rol:**
- el copiloto hace polling periódico (o lectura por webhook de cambios)
- detecta diferencias entre lo que dice la hoja y el registro
- si hay diferencia → conflicto → espera al humano (R3)
- NUNCA escribe en la hoja en el MVP

**Hallazgo actualizado 2026:**
- para leer una hoja privada desde backend, usar **Service Account**
- los roles IAM de Google Cloud **no** dan acceso a Google Sheets por sí solos
- la hoja debe compartirse directamente con el email del service account
- para una hoja específica compartida, **no hace falta domain-wide delegation**

**Cómo obtener credenciales:**
1. Google Cloud Console → nuevo proyecto
2. APIs & Services → activar Google Sheets API
3. IAM & Admin → Service Accounts → crear
4. Keys → Create new key → JSON
5. Compartir la hoja con el email del service account
6. Agregar variables en `.env.local` (ver `.env.example`)

**Qué necesitas del equipo:**
- ID de la hoja de cálculo (en la URL)
- Nombre exacto de la pestaña
- Columnas exactas que usa el equipo

---

### CANALES DE COMUNICACIÓN

#### Gmail API ⏳ (v1.1)
**Por qué:** el correo institucional es el canal oficial de acuerdos entre unidades. Leerlo automáticamente elimina el "me enteré tarde".

**Rol:**
- lee correos entrantes del inbox
- los clasifica (alta, solicitud, oferta, conflicto, administrativo, instrucción maliciosa)
- extrae datos (qué cama, qué unidad)
- propone acción al encargado (nunca actúa solo)

**Cómo obtener credenciales:**
1. Google Cloud → Credentials → OAuth 2.0 Client ID
2. Scopes: `gmail.readonly` + `gmail.send` (para borradores)
3. Refresh token con el flujo OAuth

#### Telegram Bot API ⏳ (v1.1)
**Por qué:** canal del turno. Permite aprobar/rechazar propuestas sin abrir el panel, avisar al equipo de aseo con un botón, y recibir alertas proactivas.

**Cómo crear el bot:**
1. Hablar con @BotFather en Telegram
2. `/newbot` → obtener token
3. Crear grupos: turno y aseo
4. Obtener IDs de los grupos
5. Agregar variables en `.env.local`

---

### CI/CD Y CALIDAD

#### GitHub Actions ✅ (ahora)
**Por qué:** ejecuta validación automática (typegen + tsc + build) en cada PR. Evita que código roto llegue a staging.
**Archivo:** `.github/workflows/ci.yml` — ya incluido en el kit.

---

### OBSERVABILIDAD ⏳ (staging/piloto)

#### Sentry (recomendado)
**Por qué:** captura errores del servidor con stack trace, contexto de request y usuario. Esencial cuando hay usuarios reales operando.
**Cuándo activar:** al entrar a staging operativo.

#### Vercel Logs
**Por qué:** logs en tiempo real de cada request, tiempos, errores. Ya disponible en el dashboard de Vercel.

---

### AUTENTICACIÓN ⏳ (antes del piloto)

#### Clerk o NextAuth.js
**Por qué:** el sistema necesita saber quién hace qué. La caja negra registra "M. Rojas confirmó el alta" — sin auth, ese dato es una ficción.

**Roles mínimos:**
- `encargada` — puede confirmar altas, validar inspecciones, configurar
- `aseo` — solo ve sus tareas, marca hitos
- `jefatura` — solo lectura de métricas y reportes
- `admin` — configuración del sistema

---

## Qué NO necesitamos (y por qué)

| Herramienta | Por qué no |
|---|---|
| Docker | Supabase maneja la BD; Vercel maneja el deploy. Sin ops propias. |
| Redis / cache externo | Next.js caché + Supabase son suficientes para la escala del piloto. |
| GraphQL | La API `/api/ops` con switch/case es más simple y más segura para este dominio. |
| ORM pesado (Prisma) | Drizzle es más ligero, type-safe y funciona perfectamente con Supabase. |
| Microservicios | El monolito Next.js es la arquitectura correcta para este proyecto en su fase actual. |
| CDN propia | Vercel Edge Network lo cubre. |
| Base de datos separada para audit | La tabla `events` append-only en Supabase es suficiente. |
| Message queue (RabbitMQ, etc.) | El mantenimiento perezoso reemplaza la necesidad de workers. |

---

## Costos estimados del stack

| Servicio | Plan | Costo/mes | Para qué fase |
|---|---|---|---|
| GitHub | Free (privado) | $0 | Todo |
| Cursor | Pro | ~$20 USD | Todo |
| Supabase DEV | Free | $0 | Desarrollo |
| Supabase STAGING | Pro | ~$25 USD | Staging |
| Supabase PILOT | Pro | ~$25 USD | Piloto |
| Vercel | Hobby/Pro | $0-$20 | Todo |
| Sentry | Free tier | $0 | Staging+ |
| Google Cloud APIs | Pay as you go | < $5 | v1.1+ |
| **Total desarrollo** | — | ~$20 | Ahora |
| **Total staging** | — | ~$70 | Próxima fase |
| **Total piloto** | — | ~$70 | Piloto |

---

## Resumen de decisión

| Stack | Decisión | Cuándo |
|---|---|---|
| GitHub + Cursor + Vercel + Supabase | ✅ Activar ahora | Inmediato |
| Google Sheets API | ⏳ Activar en v1.2 | Próxima fase |
| Gmail API + Telegram | ⏳ Activar en v1.1 | Próxima fase |
| Auth (Clerk/NextAuth) | ⏳ Antes del piloto | Antes del piloto |
| Sentry | ⏳ En staging | Al entrar a staging |
