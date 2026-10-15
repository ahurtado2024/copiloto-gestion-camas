# ESTRATEGIA DE ENTORNOS

> Separación mínima recomendada para no mezclar desarrollo, pruebas y piloto.

---

## Entornos

| Entorno | Objetivo | Datos | Hosting | DB |
|---|---|---|---|---|
| Sandbox | Experimentación aislada | Ficticios | este entorno | PostgreSQL local |
| DEV | Desarrollo real del equipo | Ficticios | local + Vercel preview | Supabase DEV |
| STAGING | Release candidate / demo interna | Ficticios estables | Vercel staging | Supabase STAGING |
| PILOT | Uso real controlado | Operativos reales minimizados | Vercel pilot/prod | Supabase PILOT |

---

## Política por entorno

### DEV
- seed libre
- reseteable
- cambios de esquema frecuentes
- debugging abierto

### STAGING
- datos ficticios estables
- sin resets improvisados
- se valida release aquí antes de pasar
- demo para stakeholders

### PILOT
- access protection
- auth obligatoria
- logs centralizados
- backups revisados
- cambios por ventana controlada

---

## Secrets por entorno

Nunca compartir:
- `DATABASE_URL`
- tokens de bot
- OAuth secrets
- secrets de auth

Cada entorno con sus propios secretos.

---

## Promoción entre entornos

```text
Sandbox → DEV → STAGING → PILOT
```

No saltar directo de sandbox a pilot.

---

## Regla de oro

> **Lo que se rompe en DEV enseña.**
> **Lo que se rompe en PILOT cuesta reputación.**
