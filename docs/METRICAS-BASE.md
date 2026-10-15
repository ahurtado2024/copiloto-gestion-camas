# LÍNEA BASE — Medición del proceso manual actual

> **Sin esto, todo lo demás es opinión.**
> Medir el proceso tal como está hoy, sin mejorarlo durante la medición.
> El número que más duele es el que más valor tiene.

---

## Instrucciones

Registrar **5 a 10 casos reales** del proceso manual actual. Cada fila es una cama que pasó de "ocupada" a "disponible" (o que se quedó en el camino).

### Campos a llenar

| # | Campo | Descripción | Ejemplo |
|---|---|---|---|
| 1 | **Fecha** | Día del caso | 2026-10-12 |
| 2 | **Cama** | Código de la cama | C-304 |
| 3 | **Unidad / Establecimiento** | Servicio y hospital | Medicina 3 · HRR |
| 4 | **Hora del alta** | Cuándo se firmó el alta en el servicio | 08:15 |
| 5 | **Hora en que te enteraste** | Cuándo supiste que la cama estaba libre | 09:15 |
| 6 | **¿Cómo te enteraste?** | Canal por el que llegó la info | Llamada telefónica casual |
| 7 | **Hora en que avisaste a aseo** | Cuándo mandaste el aviso a limpieza | 09:22 |
| 8 | **Hora en que aseo tomó** | Cuándo aseo confirmó que iba | 10:40 |
| 9 | **Hora de inicio de limpieza** | Cuándo empezaron a limpiar | 10:45 |
| 10 | **Hora de término de limpieza** | Cuándo aseo dijo que terminó | 13:30 |
| 11 | **Hora de verificación** | Cuándo alguien revisó ropa/baño/insumos | 14:00 |
| 12 | **Hora en que la cama quedó disponible** | Cuándo se pudo ofrecer de verdad | 14:10 |
| 13 | **¿Se perdió el aviso?** | ¿En algún momento nadie sabía que estaba libre? | Sí — nadie avisó hasta que llamé |
| 14 | **Notas** | Lo que pasó, por qué tardó, qué se podría haber hecho | Aseo estaba en otra tarea |

---

## Plantilla (copiar y llenar)

```
CASO 1
Fecha:
Cama:
Unidad / Establecimiento:
Hora del alta:
Hora en que me enteré:
¿Cómo me enteré?:
Hora aviso a aseo:
Hora aseo tomó:
Hora inicio limpieza:
Hora término limpieza:
Hora verificación:
Hora cama disponible:
¿Se perdió el aviso?:
Notas:
```

```
CASO 2
...
```

---

## Métricas que se calcularán

| Métrica | Fórmula | Lo que mide |
|---|---|---|
| **M1 manual** | hora aviso aseo − hora del alta | Cuánto tarda en salir el aviso HOY |
| **M2 manual** | hora cama disponible − hora del alta | Ciclo completo HOY |
| **M3 manual** | casos donde "se perdió el aviso" = sí | Camas que nadie avisó |
| **Tiempo muerto** | hora cama disponible − hora término limpieza | Tiempo entre "aseo terminó" y "se puede usar" |
| **Demora de enterarse** | hora que te enteraste − hora del alta | Cuánto tarda en llegar la noticia |

---

## Ejemplo ilustrativo del handoff de negocio (a confirmar con datos reales)

```
Alta escrita:        08:15
Me enteré:           09:15 (1 h después, por teléfono casual)
Avisé a aseo:        09:22
Aseo respondió:      10:40 (1 h 18 min después del aviso)
Aseo terminó:        13:30
Lo vi (o alguien):   14:10
Cama disponible:     14:10

M1 manual = 09:22 - 08:15 = 67 min (meta del copiloto: < 5 min)
M2 manual = 14:10 - 08:15 = 355 min = ~6 horas (meta: < 60 min)
¿Se perdió? = Sí — nadie sabía hasta la llamada
```

---

## Regla metodológica

1. **Medir sin mejorar:** no cambiar el proceso durante la medición.
2. **Anotar las horas aunque incomoden:** la honestidad es el activo.
3. **Incluir los casos donde nadie avisó:** son los más valiosos.
4. **No adivinar:** si no se sabe la hora exacta, poner "~" y una aproximación.
5. **5 casos mínimo** para tener una base estadística decente.

## Estado actual

⬜ **Pendiente** — requiere que el usuario llene esta plantilla con datos de su turno real.
