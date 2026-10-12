# Atento — Versión docente del cuestionario

**Borrador v0.1 — 2026-10-12 — pendiente de revisión por el asesor clínico**

Instrumento: `vanderbilt-docente-es-1.0` (`src/data/instrumento/vanderbilt-docente-es-1.0.json`),
ids `T01…T43`, `informante: "docente"`. Flujo público: `/docente` (presentación, indexable) →
`/docente/consentimiento` → `/docente/datos` → `/docente/cuestionario` → `/docente/gracias`.

## 1. Fuente y edición

| Qué | Detalle |
|---|---|
| Escala | NICHQ Vanderbilt Assessment Scale — **Teacher Informant**, **1.ª edición (2002)**, © American Academy of Pediatrics y National Initiative for Children's Healthcare Quality (NICHQ). Adaptación de las Vanderbilt Rating Scales de Mark L. Wolraich, MD. |
| Versión en español usada | «Sistema NICHQ Vanderbilt de Evaluación. Cuestionario del MAESTRO» (bilingüe español/inglés), hojas D4s1–D4s4, «Revisión - 0303». Traducción © 2005 American Academy of Pediatrics, University of North Carolina at Chapel Hill (North Carolina Center for Children's Healthcare Improvement) y NICHQ. |
| URL de la fuente en español | <https://www.ohsu.edu/sites/default/files/2021-02/Pediatric-Autism-Intake-Packet-Spanish.pdf> (paquete de admisión en español de Oregon Health & Science University, páginas 8–10). Descargado el 2026-10-11; SHA-256 del PDF `d0b68147be5c6a454e09b47ce2e9e6701d010b3ad46d46075eab2b215df9ff46`. |
| Copia idéntica (contraste) | <https://www.eriefamilyhealth.org/wp-content/uploads/2022/03/Teacher-VANDERBILT-3-SPAN.pdf> (mismo texto, mismas hojas D4s1–D4s4). |
| Guía de puntuación (original) | <https://nichq.org/wp-content/uploads/2024/09/NICHQ-Vanderbilt-Assessment-Scales.pdf> (NICHQ, en inglés): hoja D4 «Teacher Informant» y página «Scoring Instructions for the NICHQ Vanderbilt Assessment Scales», sección *Teacher Assessment Scale*. SHA-256 `f26a0e65a6bb1a00353ac44366f8689a28e8c36806211a90ad972b1c9abd12eb`. |

No se encontró una versión en español del informante docente en medicine.tulane.edu (donde está
la de padres); la búsqueda en .edu/.gov llevó a OHSU. La versión de OHSU **es la 1.ª edición**
(43 ítems, misma numeración y agrupaciones que la hoja D4 inglesa de 2002), así que no hubo que
recurrir a la 2.ª edición (AAP 2011/2012) como se hizo con la de padres.

## 2. Ítems y agrupaciones (verificados contra la fuente)

| Ítems | Escala de la fuente | Respuesta | Escala interna en Atento |
|---|---|---|---|
| 1–9 | Inatención (DSM A1a–A1i) | 0–3 | `inatencion` |
| 10–18 | Hiperactividad/impulsividad (A2a–A2i) | 0–3 | `hiperactividad` |
| 19–28 | Oposición desafiante / trastorno de conducta (**una sola escala combinada**) | 0–3 | `conducta` |
| 29–35 | Ansiedad/depresión | 0–3 | `ansiedad_depresion` |
| 36–38 | Desempeño — rendimiento académico: lectura, matemáticas, expresión escrita | 1–5 | `desempeno` |
| 39–43 | Desempeño — conducta escolar: relación con compañeros, sigue instrucciones, conducta en clase, concluye las tareas asignadas, habilidad para organizarse | 1–5 | `desempeno` |

Total: **43 ítems**. La referencia de la que partía el encargo coincide con la fuente en número de
ítems, agrupaciones y reglas. Única diferencia de redacción: el ítem 41 se llama «Conducta en
clase» en la fuente española (en inglés, «Disrupting class», «interrumpir la clase»). Se conserva
la redacción española.

Etiquetas de la fuente: frecuencia *Nunca / A veces / Seguido / Muy seguido* (0–3); desempeño
*Excelente / Sobre lo normal / Normal / Cierta dificultad / Con dificultad* (1–5). Son distintas
de las del formulario de padres (*De vez en cuando / A menudo / Muy a menudo*; *Algo problemático
/ Problemático*), porque cada formulario se copia de su fuente.

Ajustes editoriales (únicos):

- Ítem 32: la fuente dice «Se desprecia a si mismo se siente inferior»; se restituyen la tilde y la
  conjunción: «Se desprecia a sí mismo o se siente inferior» (inglés: «Feels worthless or
  inferior»).
- Se conservan las formas «(a)» de la fuente («olvidadizo(a)», «enojado(a)»…).

No se incluyen (minimización de datos): nombres del docente y del alumno, materia, hora de clase,
grado, semanas/meses de observación, pregunta sobre medicación ni comentarios libres.

## 3. Reglas de puntuación (guía de NICHQ, *Teacher Assessment Scale*)

Un ítem de frecuencia cuenta si vale **2 o 3**; un ítem de desempeño cuenta si vale **4 o 5**.

| Escala | Regla de la fuente | `REGLAS["vanderbilt-docente-es-1.0"]` |
|---|---|---|
| Inatención | 2 o 3 en 6 de 9 (ítems 1–9) | `inatencion: 6` |
| Hiperactividad/impulsividad | 2 o 3 en 6 de 9 (10–18) | `hiperactividad: 6` |
| Oposición desafiante/conducta | 2 o 3 en 3 de 10 (19–28) | `conducta: 3` |
| Ansiedad/depresión | 2 o 3 en 3 de 7 (29–35) | `ansiedad_depresion: 3` |
| Desempeño | «Score a 4 or 5 on **any** of the Performance questions 36–43» → ≥ 1 ítem con 4 o 5 | `desempeno: 1` |
| Oposición (separada) | No existe en el formulario docente | `oposicion: 4` nominal; **sin ítems → nunca positiva** |

En la fuente, cada cribado (inatento, hiperactivo, combinado, oposición/conducta,
ansiedad/depresión) exige además desempeño positivo. Atento guarda la positividad de cada escala
por separado (`pos_*`) y aplica el criterio de desempeño en el **nivel** (regla propia de Atento,
la misma que para padres: `calcularNivel` en `src/lib/puntuacion/puntuar.ts`). Ítems faltantes:
misma regla que en padres (más del 20 % de una escala sin responder → no positiva).

El servidor puntúa y guarda `nivel` y `pos_*` para investigación, pero **al docente no se le
muestra nivel, umbrales ni interpretación**: `POST /api/respuesta` responde `{ok: true}` sin
`nivel` para este instrumento, y la hoja imprimible solo cuenta frases marcadas «seguido/muy
seguido» por escala y lista los ítems de desempeño con 4–5.

## 4. Mapeo de escalas

- La escala combinada de oposición/conducta (19–28) se guarda en `conducta` (`punt_conducta`
  0–30, `pos_conducta` con umbral 3). `oposicion` queda sin ítems (`punt_oposicion = 0`,
  `pos_oposicion = 0`). Así no hay columnas nuevas en D1 ni en los microdatos.
- Consecuencia: `pos_conducta` **no significa lo mismo** en padres (14 ítems de conducta disocial,
  umbral 3) que en docentes (10 ítems mezclando oposición y conducta, umbral 3). Cualquier análisis
  que mezcle informantes debe filtrar por `version_instrumento`. El reporte de concordancia
  compara «familia: oposición O conducta» con «docente: conducta (combinada)» y lo advierte.
- Alertas: un docente con `conducta` positiva genera la alerta `conducta` (nunca `oposicion`); no
  se muestra al docente, solo queda en la fila.
- Ítems 1–18: equivalentes en ambos formularios (mismos criterios DSM-5 A1a–A2i). Son la base de
  las correlaciones del reporte de concordancia.

## 5. Vínculo con la familia

- La familia obtiene un `codigoVinculo` de 8 caracteres en `/resultado`. El botón «Invitar al
  docente» comparte `https://atento.galexbh.dev/docente?codigo=XXXXXXXX` (origen de `Astro.site`);
  el texto de WhatsApp no incluye ningún dato del resultado.
- En `/docente` el código se normaliza (mayúsculas; sin espacios, guiones ni puntos), se guarda en
  `atento:docente:codigo` y se quita de la barra de direcciones. En `/docente/datos` es opcional
  pero recomendado; sin código se puede responder igual, pero no se podrá comparar con la familia.
- Se guarda en `codigo_vinculo` de la fila del docente. **No existe ningún endpoint que devuelva
  respuestas por código**: ni la familia ve lo del docente ni el docente lo de la familia.
- Tras enviar, el código se borra del dispositivo del docente para que no pase al siguiente niño.

## 6. Datos mínimos y consentimiento

Departamento y municipio **de la escuela**, edad 6–12, sexo, código opcional; `informante` siempre
`docente` (no se pregunta). Consentimiento docente versión `2026-10-12`
(`docs/03-legal/consentimiento-docente.md`): sin la casilla opcional de investigación no se envía
nada al servidor y la hoja se genera localmente.

Validación (`EsquemaEnvio`): el instrumento docente solo admite `informante: "docente"` y no admite
`respuestasAtento`; los instrumentos de padres (Vanderbilt padres, Atento) ya no admiten
`informante: "docente"`. El servidor sigue exigiendo el código ya normalizado (`^[A-Za-z0-9]{8}$`).

## 7. Mapa público y agregados

Las respuestas del instrumento docente **no** cuentan en la publicación pública
(`src/lib/publico/consultar.ts`, filtro `version_instrumento NOT IN (...)`) ni en la versión
`todas` de `agregados_municipio` (`agregar()` solo las suma en su propia versión): el docente
describe a un niño que ya pudo contar su familia y se contaría dos veces. Se filtra por
`version_instrumento` y no por `informante` para no alterar lo ya publicado (antes de esta versión
algunas familias marcaron «docente» con el instrumento de padres; esas filas siguen contando). El
panel admin sí las ve (filtro «Instrumento»).

## 8. Concordancia padre–docente (panel)

`/admin/concordancia` y `/api/admin/reporte/concordancia` (`src/lib/reportes/concordancia.ts`):

- Par = una fila de familia (instrumento distinto del docente e informante ≠ docente) y una del
  docente con el mismo `codigo_vinculo` (comparado en mayúsculas). Si hay varias de un mismo
  informante, se usa **la más reciente** (mayor `creado_en`; empate: mayor `id`).
- Filtros: departamento, municipio, edad y sexo sobre la fila de la familia; periodo y «solo con
  consentimiento» sobre ambas.
- Medidas: n de pares; por escala, tabla 2×2, % de acuerdo (IC de Wilson) y kappa de Cohen (IC 95 %
  con el error estándar aproximado de Cohen); Pearson (IC por z de Fisher) de puntajes de
  inatención (1–9), hiperactividad (10–18) y total 1–18; % de pares «positivos en ambos entornos»
  (inatención o hiperactividad positiva según los dos informantes).
- Supresión: con menos de 5 pares no se muestra ninguna medida; celdas 2×2 con n < 5 suprimidas.
  Cada consulta queda en `auditoria_admin`.
- Microdatos: columnas `T01…T43` y `par_id` (HMAC del código con la misma clave por descarga que
  seudonimiza `id`; vacío sin código). El código nunca se exporta.

## 9. Dudas para el asesor clínico

1. **Regla de desempeño.** La guía de la 1.ª edición dice «4 o 5 en cualquiera de las preguntas de
   desempeño 36–43» (≥ 1 ítem), y así está implementado. La 2.ª edición de la AAP (2011/2012) usa
   «2 ítems con 4 o 1 ítem con 5». ¿Mantenemos la de la 1.ª edición (coherente con la fuente y con
   el formulario de padres) o adoptamos la más estricta para el docente?
2. **Escala combinada de oposición/conducta.** El docente tiene una sola escala (19–28, ≥ 3 de 10)
   que mezcla oposición (19–22) y conducta (23–28). ¿Es aceptable guardarla como `conducta`?
   ¿Conviene, para investigación, calcular además subconteos 19–22 y 23–28 aunque la fuente no
   publique umbrales separados?
3. **Nivel para investigación.** Se aplica al docente la misma regla de nivel de Atento que a las
   familias. ¿Tiene sentido un nivel por informante o solo debería analizarse la concordancia y el
   criterio de dos entornos?
4. **Ítem 32.** Validar la corrección editorial («Se desprecia a sí mismo **o** se siente
   inferior»).
5. **Etiquetas distintas entre formularios** («Seguido/Muy seguido» frente a «A menudo/Muy a
   menudo»; «Cierta dificultad/Con dificultad» frente a «Algo problemático/Problemático»). Se
   conservan las de cada fuente; ¿conviene unificarlas para Honduras o afectaría a la validez?
6. **Ítem 41 «Conducta en clase»** (inglés «Disrupting class»): la traducción española es más
   amplia que el original. ¿Se mantiene?
7. **Tiempo de observación.** La fuente pide indicar semanas o meses de observación y si el niño
   tomaba medicación; no se preguntan por minimización de datos. ¿Debería excluirse del análisis a
   docentes con poco tiempo de observación (habría que preguntarlo)?
8. **Kappa.** Con prevalencias bajas el kappa puede ser bajo aunque el acuerdo bruto sea alto
   (paradoja de kappa). ¿Se añade PABAK o acuerdo positivo/negativo específico?
9. **Validación local.** La traducción es estadounidense (Carolina del Norte, 2005). Igual que con
   la de padres, la validación en Honduras queda pendiente con el socio académico.
