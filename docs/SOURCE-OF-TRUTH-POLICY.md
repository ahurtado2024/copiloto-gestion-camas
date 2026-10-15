# POLÍTICA DE FUENTE DE VERDAD

> Documento crítico de negocio y arquitectura.
> Define qué sistema manda hoy y cuál complementa.

---

## Política oficial actual

### La hoja del turno es la fuente operacional primaria
La hoja de cálculo del área / encargado:
- la actualiza el humano,
- la usa el turno,
- la entiende todo el equipo,
- y hoy es el instrumento real de operación.

Por tanto:

> **La hoja manda en la operación humana.**

---

### Supabase es el registro en paralelo y respaldo estructurado
Supabase almacena:
- camas estructuradas,
- ciclos de limpieza,
- propuestas,
- conflictos,
- mensajes,
- caja negra,
- métricas,
- configuración,
- informes de turno.

Por tanto:

> **Supabase respalda, estructura, audita y mide.**

No reemplaza la hoja en esta fase.

---

## Traducción práctica

### Lo que el sistema SÍ puede hacer con la hoja
- leerla
- interpretar sus estados
- detectar contradicciones
- abrir conflictos
- mostrar comparaciones
- usarla como evidencia de contexto

### Lo que el sistema NO puede hacer en el MVP
- escribir en la hoja automáticamente
- corregir la hoja en silencio
- declarar que Supabase ganó sin aprobación humana
- asumir que la hoja “está mal” solo porque difiere

---

## Regla de arbitraje

Si la hoja y Supabase difieren:

```text
hoja ≠ registro paralelo
        ↓
se abre conflicto
        ↓
se congela la escritura automática
        ↓
decide un humano
```

Nunca:

```text
hoja ≠ registro paralelo
        ↓
“el sistema decide y pisa”   ❌
```

---

## Principio de evolución futura

A futuro, el sistema podría reemplazar gradualmente a la hoja.
Pero eso no ocurre por decreto.

Solo puede ocurrir si se demuestra que el sistema:
- es igual o más rápido,
- igual o más confiable,
- igual o más simple de usar,
- y el usuario lo prefiere voluntariamente.

Hasta entonces:

> **Hoja = operación viva**
> **Supabase = respaldo y memoria**

---

## Frase ejecutiva

> **La hoja opera. Supabase recuerda.**
