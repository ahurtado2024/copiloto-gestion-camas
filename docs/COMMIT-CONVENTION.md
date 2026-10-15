# CONVENCIÓN DE COMMITS Y BRANCHES

---

## Formato de commits (Conventional Commits)

```
<tipo>(<alcance>): <descripción corta en español>

[cuerpo opcional — qué y por qué, no cómo]

[footer opcional — Breaking change, closes #issue]
```

### Tipos

| Tipo | Cuándo usarlo |
|---|---|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Solo documentación |
| `style` | Solo UI/CSS, sin cambio de lógica |
| `refactor` | Refactoring sin nueva funcionalidad ni bug fix |
| `test` | Agregar o corregir tests |
| `chore` | Tareas de mantenimiento (deps, config, CI) |
| `db` | Cambios de schema o migraciones |
| `perf` | Mejora de rendimiento |
| `security` | Mejora de seguridad |

### Alcances recomendados

`engine` · `api` · `ui` · `db` · `sheets` · `gmail` · `telegram` · `auth` · `docs` · `ci` · `config`

### Ejemplos

```
feat(engine): agregar validación de conflictos en propuesta de alta
fix(api): corregir validación de bedOp con OperationalError
docs(stack): agregar guía de Google Sheets API
db(schema): agregar tabla sheet_syncs para historial de lecturas
chore(ci): agregar smoke test de R2 en GitHub Actions
style(ui): mejorar contraste de badges de estado en tema claro
feat(sheets): conectar lectura real de hoja con Google Sheets API
```

---

## Naming de branches

```
<tipo>/<descripción-corta-en-kebab-case>
```

### Ejemplos

```
feat/auth-roles-basicos
fix/engine-propuesta-obsoleta
docs/roadmap-v1-1
db/agregar-tabla-sheet-syncs
chore/actualizar-dependencias
style/tablero-kpi-cards
feat/sheets-lectura-real
feat/telegram-bot-turno
```

---

## Ramas principales

| Rama | Uso | Protección |
|---|---|---|
| `main` | Staging / Release | PR obligatorio + checks verdes |
| `develop` | Integración de features | PR recomendado |
| `feat/*` | Feature individual | — |
| `fix/*` | Bugfix | — |
| `hotfix/*` | Fix urgente en staging | PR obligatorio |

---

## Flujo recomendado

```
develop ← feat/mi-feature
           └── PR → review → merge
main    ← develop
           └── PR → checks → merge → Vercel staging deploy
```
