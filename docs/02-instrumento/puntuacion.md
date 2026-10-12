# Atento — Reglas de puntuación v0

**Borrador v0.1 — pendiente de revisión por profesional de salud mental**
Fecha: 2026-10-11

Todas las reglas son deterministas. No hay modelos ni IA en producción. El código debe poder reproducir cada resultado a partir de las respuestas y de este documento.

## 1. Escala y datos de entrada

- Ítems 1–47 de Vanderbilt padres 1ª ed.: respuesta 0–3 (Nunca, A veces, Seguido, Casi siempre).
- Ítems 48–55 (desempeño): respuesta 1–5 (1 = excelente … 5 = problemático).
- Ítems Atento A01–A18 (0–3) y D01–D08 (1–5): **se guardan, no se puntúan** en v1.

Un ítem de síntoma se considera **positivo** si la respuesta es **2 o 3**.
Un ítem de desempeño se considera **positivo** si la respuesta es **4 o 5**.

## 2. Reglas Vanderbilt padres 1ª ed.

| Subescala | Ítems | Regla de positivo | Nombre interno |
|---|---|---|---|
| Inatención | 1–9 | ≥ 6 ítems con 2–3 | `inatencion_pos` |
| Hiperactividad-impulsividad | 10–18 | ≥ 6 ítems con 2–3 | `hiper_pos` |
| Oposición (negativista desafiante) | 19–26 | ≥ 4 ítems con 2–3 | `oposicion_pos` |
| Conducta | 27–40 | ≥ 3 ítems con 2–3 | `conducta_pos` |
| Ansiedad / depresión | 41–47 | ≥ 3 ítems con 2–3 | `ansdep_pos` |
| Desempeño | 48–55 | ≥ 1 ítem con 4–5 | `desempeno_pos` |

Además se calculan los **conteos** (no las sumas):

- `n_inat` = número de ítems 1–9 con 2–3 (0–9).
- `n_hiper` = número de ítems 10–18 con 2–3 (0–9).
- `n_sint` = max(`n_inat`, `n_hiper`).

Presentación sugerida (solo para el PDF al profesional, no para la familia):

| `inatencion_pos` | `hiper_pos` | Etiqueta |
|---|---|---|
| sí | sí | Indicadores de presentación combinada |
| sí | no | Indicadores de presentación inatenta |
| no | sí | Indicadores de presentación hiperactiva-impulsiva |

## 2 bis. Reglas Vanderbilt docente 1ª ed. (`vanderbilt-docente-es-1.0`)

Detalle, fuente y dudas en [`version-docente.md`](./version-docente.md). Ítems `T01–T43`.

| Subescala | Ítems | Regla de positivo | Escala interna |
|---|---|---|---|
| Inatención | 1–9 | ≥ 6 ítems con 2–3 | `inatencion` |
| Hiperactividad-impulsividad | 10–18 | ≥ 6 ítems con 2–3 | `hiperactividad` |
| Oposición desafiante/conducta (combinada) | 19–28 | ≥ 3 ítems con 2–3 | `conducta` |
| Ansiedad / depresión | 29–35 | ≥ 3 ítems con 2–3 | `ansiedad_depresion` |
| Desempeño (académico 36–38, conducta escolar 39–43) | 36–43 | ≥ 1 ítem con 4–5 | `desempeno` |
| Oposición (separada) | — | sin ítems: nunca positiva | `oposicion` |

El nivel y las alertas se calculan con las mismas reglas de las secciones 3 y 4 y se guardan para
investigación, pero **no se muestran al docente** (la API responde sin `nivel` y la hoja imprimible
solo muestra conteos). Las respuestas docentes no entran en el mapa público.

## 3. Nivel Atento

Es lo único que ve la familia, junto con las alertas.

```
sintomas_pos = inatencion_pos OR hiper_pos

SI sintomas_pos AND desempeno_pos            → ALTO
SI sintomas_pos AND NOT desempeno_pos        → MODERADO
SI n_sint IN {4, 5} AND desempeno_pos        → MODERADO
EN OTRO CASO                                 → BAJO
```

| Nivel | Condición | Lógica clínica |
|---|---|---|
| **Alto** | Síntomas positivos en al menos una subescala **y** desempeño positivo. | Cumple el corte de síntomas y hay deterioro (criterio D). Es el "positivo" de Vanderbilt. |
| **Moderado** | (a) Síntomas positivos pero sin deterioro reportado, **o** (b) 4–5 síntomas en una subescala con deterioro. | (a) El padre ve muchos síntomas pero no impacto: puede ser subreporte de desempeño o síntomas sin trastorno. (b) Subumbral con impacto: zona gris que merece evaluación, especialmente en niñas. |
| **Bajo** | Resto. | No hay indicadores suficientes en este cuestionario. No descarta nada. |

Evaluación en orden: primero ALTO, luego MODERADO, luego BAJO. Las condiciones son excluyentes en ese orden.

## 4. Alertas

Independientes del nivel. Pueden aparecer con nivel bajo.

| Alerta | Condición | Prioridad en el texto |
|---|---|---|
| `alerta_oposicion` | `oposicion_pos` | Normal: "se recomienda comentar con el profesional". |
| `alerta_conducta` | `conducta_pos` | **Prioritaria**: se recomienda evaluación pronto. Los ítems 27–40 incluyen agresión, crueldad, fugas, robo. |
| `alerta_ansdep` | `ansdep_pos` | **Prioritaria**: se recomienda evaluación pronto; se incluye línea de ayuda. |

Regla de orden de presentación: conducta y ansiedad/depresión antes que oposición. Si hay dos o más alertas, se muestra un solo bloque de "atención prioritaria" con los temas listados.

**Pendiente con el asesor:** Vanderbilt no incluye ítems de autolesión o ideación suicida. Decidir si se añade una pregunta de seguridad (fuera de la escala) y qué texto de emergencia la acompaña.

## 5. Ítems faltantes

Vanderbilt no publica una regla de imputación. Proponemos la siguiente, conservadora, y la marcamos para revisión.

| Situación | Regla |
|---|---|
| Faltan ítems en una subescala de síntomas (1–9 o 10–18) | Si faltan **≤ 1** ítem: se puntúa con los presentes (un ítem faltante cuenta como 0). Si faltan **≥ 2**: la subescala se marca `incompleta`; no se puede declarar positiva. |
| Faltan ítems en oposición, conducta o ansiedad/depresión | Mismo criterio: ≤ 1 faltante se tolera (cuenta como 0); ≥ 2 marca la subescala `incompleta` y la alerta no se evalúa. |
| Faltan ítems de desempeño | Se evalúa con los presentes. Si falta **la mitad o más** de los ítems, `desempeno` se marca `incompleto`: 4 de 7 en el formulario de padres en español y 4 de 8 en el docente. El formulario no ofrece la opción "no aplica"; si se añadiera, no contaría como faltante. |
| Cualquier subescala de síntomas `incompleta` | El nivel se calcula igual, pero el resultado muestra la nota "Algunas preguntas quedaron sin responder; el resultado puede ser menos preciso". |
| Ambas subescalas de síntomas `incompletas` | No se entrega nivel. Se pide completar el cuestionario. |

Motivo de "faltante cuenta como 0": en un cribado preferimos no inflar positivos por imputación. El costo es perder algo de sensibilidad, que ya es el punto débil del informante único. El asesor puede proponer lo contrario.

El formulario debe, en todo caso, pedir todas las respuestas antes de enviar y señalar las vacías. Las reglas anteriores son para casos de envío parcial.

**Implementación.** La regla está en `src/lib/puntuacion/puntuar.ts` (`escalaCompleta`, `nivelEntregable`). El servidor rechaza un envío marcado como completo sin nivel entregable y el cuestionario pide completar las respuestas en lugar de mostrar un resultado.

## 6. Por qué no se usa la suma total como corte

Vanderbilt y el DSM usan **conteo de síntomas**, no suma de puntos. Razones:

1. **Fidelidad al criterio.** El DSM exige 6 síntomas presentes, no "mucha intensidad en pocos síntomas". Una suma de 18 puntos puede venir de 6 ítems en 3 (positivo) o de 18 ítems en 1 (ninguno positivo). Son cuadros distintos.
2. **Comparabilidad.** Los estudios de sensibilidad y especificidad que citamos (Bard 2013, resumen AAFP 2019) usan la regla de conteo. Si cambiamos la regla, esos números ya no aplican.
3. **Robustez a estilos de respuesta.** Padres que tienden a marcar "a veces" en todo inflarían una suma sin cruzar el umbral de 2–3 por ítem.
4. **Sin norma local.** Para usar sumas con cortes necesitaríamos percentiles de una muestra hondureña. No los tenemos.

La suma sí se guarda en la base anónima (por subescala) porque es útil para la calibración de ítems Atento y para análisis futuros, pero no para decidir el nivel.

## 7. Resumen de salida (contrato para el código)

```
{
  nivel: "bajo" | "moderado" | "alto",
  n_inat, n_hiper,
  inatencion_pos, hiper_pos, desempeno_pos,
  oposicion_pos, conducta_pos, ansdep_pos,
  alertas: ["conducta", "ansdep", "oposicion"]   // en este orden si aplican
  incompletas: ["inatencion", ...],
  presentacion: "combinada" | "inatenta" | "hiperactiva" | null,
  version_reglas: "v0.1"
}
```

Toda salida debe llevar `version_reglas` para poder reinterpretar datos históricos si el asesor cambia un umbral.
