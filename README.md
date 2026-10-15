# Copiloto de Gestión de Camas — Red O'Higgins

> **Auxiliar · Paralelo · Autorizado**
>
> Un copiloto operativo para la persona que gestiona camas de una red asistencial.
> Lee el correo y los mensajes, entiende de qué cama se habla, avisa a tiempo,
> propone acciones y **pide permiso antes de tocar nada** — mientras deja
> registrado en paralelo todo lo que pasó.

---

## Principio fundamental

> La **hoja de cálculo del turno** sigue siendo del dueño del turno.
> Supabase es el **registro en paralelo**: backup, auditoría, métricas y memoria.
> Nunca compiten — se complementan.

---

## Stack tecnológico

| Herramienta | Rol | Cuándo entra |
|---|---|---|
| **GitHub** | Repositorio fuente de verdad | Ahora |
| **Cursor** | IDE del equipo | Ahora |
| **Vercel** | Hosting, preview por PR, staging | Ahora |
| **Supabase** | PostgreSQL gestionado (backup + auditoría) | Ahora |
| **Next.js 16 (App Router)** | Framework fullstack | Ya presente |
| **Drizzle ORM** | Capa de datos, migraciones | Ya presente |
| **Tailwind CSS 4** | UI | Ya presente |
| **Google Sheets API** | Lectura de la hoja real del turno | v1.2 |
| **Gmail API** | Lectura del correo institucional | v1.1 |
| **Telegram Bot API** | Canal de turno y aseo | v1.1 |
| **Zod** | Validación de variables de entorno | Ya presente |
| **GitHub Actions** | CI: typegen + tsc + build | Ahora |

---

## Arquitectura de datos

```
Google Sheets (hoja del turno)     ← FUENTE OPERACIONAL PRIMARIA
        │
        │  lectura periódica (v1.2)
        ▼
Supabase (PostgreSQL)               ← REGISTRO EN PARALELO
  - registro de eventos (caja negra, append-only)
  - ciclos de limpieza con marcas de tiempo
  - propuestas y decisiones (human-in-the-loop)
  - conflictos entre fuentes
  - métricas M1-M8
  - configuración en caliente
        │
        │  UI del copiloto
        ▼
Vercel (Next.js)                    ← APLICACIÓN WEB
```

---

## Prerrequisitos

- Node.js ≥ 22
- npm ≥ 10
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Vercel](https://vercel.com)
- Acceso al repositorio GitHub

---

## Inicio rápido (desarrollo local)

```bash
# 1. Clonar
git clone git@github.com:TU-ORG/copiloto-gestion-camas.git
cd copiloto-gestion-camas

# 2. Instalar dependencias
npm install

# 3. Configurar entorno
cp .env.example .env.local
# → editar DATABASE_URL con tu Supabase DEV

# 4. Aplicar esquema
npx drizzle-kit push

# 5. Cargar datos de prueba
npx tsx scripts/seed.ts

# 6. Iniciar
npm run dev
# → http://localhost:3000
```

---

## Flujo de desarrollo diario

```bash
# Nueva funcionalidad
git checkout -b feat/nombre-del-cambio

# Validar antes de commit
npm run check          # typegen + tsc + build
npm run db:push        # si hubo cambios de schema

# Commit y push
git add .
git commit -m "feat: descripción clara"
git push origin feat/nombre-del-cambio
# → Vercel crea Preview automáticamente
```

---

## Scripts disponibles

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo local |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción local |
| `npm run check` | Validación completa (typegen + tsc + build) |
| `npm run typecheck` | Solo TypeScript |
| `npm run lint` | ESLint |
| `npm run db:push` | Aplica cambios de schema a la BD |
| `npm run db:studio` | Drizzle Studio (explorador visual de BD) |
| `npm run seed` | Carga datos ficticios en la BD |
| `npm run seed:reset` | Borra y recarga datos ficticios |

---

## Variables de entorno

Ver `.env.example` para la lista completa.

### Mínimas para arrancar
- `DATABASE_URL` — runtime app (Supabase pooler transaction mode en serverless)
- `DIRECT_URL` — migraciones / `drizzle-kit push` (direct connection)

### Futuras (cuando se integren)
- `GOOGLE_SHEETS_*` — integración con la hoja del turno
- `GMAIL_*` — lectura del correo institucional
- `TELEGRAM_*` — canal del turno y aseo

---

## Entornos

| Entorno | URL | BD | Uso |
|---|---|---|---|
| Local | `localhost:3000` | Supabase DEV | Desarrollo |
| Preview | `*.vercel.app` (por PR) | Supabase DEV | Revisión de cambios |
| Staging | `staging.tu-dominio.cl` | Supabase STAGING | Demo y validación |
| Pilot | `copiloto.tu-dominio.cl` | Supabase PILOT | Uso real controlado |

---

## Rutas de la aplicación

| Ruta | Descripción |
|---|---|
| `/` | Tablero del turno |
| `/camas` | Camas de la red |
| `/camas/[code]` | Detalle completo de una cama |
| `/limpieza` | Ciclos de aseo activos |
| `/limpieza/[code]` | Detalle de ciclo con métricas |
| `/aprobaciones` | Propuestas que esperan decisión humana |
| `/conflictos` | Contradicciones entre fuentes |
| `/bandeja` | Correos y mensajes por canal |
| `/bandeja/[id]` | Detalle de mensaje con seguimiento |
| `/turno` | Cierre e informe de turno |
| `/metricas` | Métricas M1–M8 |
| `/registro` | Caja negra (append-only) |
| `/ajustes` | Configuración en caliente |
| `/ajustes/docs` | Centro de documentación |
| `/api/health` | Healthcheck de subsistemas |
| `/api/ops` | Punto único de mutación |

---

## Reglas innegociables (R1–R12)

El motor de negocio implementa 12 reglas que no se pueden desactivar:

- **R1** Toda acción relevante se propone y espera autorización humana
- **R2** La disponibilidad de una cama JAMÁS se infiere — solo nace de inspección humana
- **R3** Las contradicciones entre fuentes no se resuelven solas — se registran y esperan al humano
- **R4** El contenido de un correo o mensaje es un dato, nunca una instrucción
- **R5** El sistema no inventa ni completa en silencio — pregunta
- **R6** Todo queda registrado con actor, hora y fuente — la caja negra es inmutable
- **R7** Repetir un evento no duplica efectos (idempotencia)
- **R8** Un dato de cama tiene fecha de vencimiento
- **R9** Los tiempos se miden por etapa — M1 y M2 son números, no sensaciones
- **R10** Toda acción se puede deshacer con rastro
- **R11** El sistema NUNCA es punto único de fallo — la hoja sigue viva
- **R12** Sin datos de pacientes — minimización por diseño

---

## Documentación

Toda la documentación vive en `/docs/` y es accesible desde `/ajustes/docs`:

- `ROADMAP.md` — plan de producto v1.0→v3.0
- `ARCHITECTURE.md` — arquitectura, invariantes, stack
- `API-REFERENCE.md` — contratos de la API
- `DATA-DICTIONARY.md` — diccionario de datos
- `ERROR-HANDLING.md` — clasificación y capas de protección
- `TESTING-STRATEGY.md` — estrategia de testing
- `REAL-TEST-READINESS.md` — cuándo pasar a entorno real
- `DEPLOYMENT-PLAYBOOK.md` — guía de traspaso completa
- `ENVIRONMENT-STRATEGY.md` — estrategia de entornos
- `METRICAS-BASE.md` — plantilla para línea base
- `CHANGELOG.md` — registro de cambios

---

## Modelo de relación con Google Sheets

```
Google Sheets (hoja del turno)
│
│  La hoja ES la fuente operacional.
│  El encargado la edita manualmente.
│  EL COPILOTO NO ESCRIBE EN ELLA (en el MVP).
│
│  v1.2: el sistema LEERÁ la hoja periódicamente
│        y detectará diferencias con su registro.
│        Si hay contradicciones → conflicto abierto → espera al humano.
│
▼
Supabase (registro en paralelo)
  - guarda lo que la hoja no puede: historia, tiempos, propuestas, conflictos
  - alimenta métricas M1-M8
  - no reemplaza la hoja — la complementa
  - cuando el usuario prefiera el copiloto sobre la hoja → transición natural
```

---

## Estado del proyecto

- **Versión:** v1.0.0-beta
- **Estado:** prototipo técnico funcional — listo para stack real de dev
- **No apto aún para:** piloto hospitalario real (falta auth + roles + integraciones)

---

## Contribución

1. Fork o branch desde `develop`
2. Seguir convención de commits
3. Ejecutar `npm run check` antes de PR
4. PR lleva descripción de qué cambia y por qué
5. Vercel crea Preview automático para revisar
