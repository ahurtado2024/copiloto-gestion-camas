# MATRIZ DE HERRAMIENTAS

> Qué herramientas usamos, cuáles son obligatorias y en qué fase entran.

---

## Core stack

| Herramienta | Rol | Obligatoria | Fase |
|---|---|---|---|
| GitHub | repo, PRs, branch protection, CI | Sí | Ahora |
| Cursor | IDE principal del equipo | Sí | Ahora |
| Vercel | deploy app / previews / staging | Sí | Ahora |
| Supabase | PostgreSQL gestionado / respaldo | Sí | Ahora |

---

## Integraciones de negocio

| Herramienta | Rol | Obligatoria | Fase |
|---|---|---|---|
| Google Sheets API | leer la hoja del turno | Sí | v1.2 |
| Gmail API | leer correo institucional | Sí | v1.1 |
| Telegram Bot API | canal del turno y aseo | Muy recomendada | v1.1 |
| Google Cloud Console | administrar Sheets/Gmail creds | Sí | Ahora |

---

## Entrega y calidad

| Herramienta | Rol | Obligatoria | Fase |
|---|---|---|---|
| GitHub Actions | CI: typegen + tsc + build + smoke | Sí | Ahora |
| Vercel CLI | env pull / link / run | Muy recomendada | Ahora |
| Drizzle Kit | schema push | Sí | Ahora |

---

## Seguridad y operación

| Herramienta | Rol | Obligatoria | Fase |
|---|---|---|---|
| Clerk o NextAuth | auth + roles | Sí | Antes del piloto |
| Sentry | observabilidad de errores | Muy recomendada | Staging |
| 1Password / Bitwarden | vault de secretos | Muy recomendada | Ahora |
| Google Admin Console | domain-wide delegation (si alguna vez hace falta) | Solo si aplica | Más adelante |

---

## Qué no es prioritario ahora

| Herramienta | Estado |
|---|---|
| Docker | opcional, no necesaria ahora |
| Redis | no necesario ahora |
| RabbitMQ / colas | no necesario ahora |
| Microservicios | no recomendado ahora |
| Kubernetes | no aplica |
