# Metodología y limitaciones

*Borrador de la página pública de Atento. Lenguaje dirigido a familias, docentes y personal de salud. Última revisión: 2026-10-11. Pendiente de revisión por el asesor clínico.*

---

## Qué mide Atento y qué no

Atento mide **indicadores de riesgo** de Trastorno por Déficit de Atención e Hiperactividad (TDAH) en niños y niñas de 6 a 12 años, según lo que observa la persona que responde (normalmente madre, padre o cuidador principal). El resultado dice si hay suficientes indicadores como para que valga la pena consultar con un profesional.

Atento **no** hace un diagnóstico. Un diagnóstico de TDAH requiere una evaluación clínica presencial, con historia del desarrollo, información de la escuela, descarte de otras causas (sueño, visión, audición, ansiedad, dificultades de aprendizaje, situaciones familiares) y criterio profesional. Ningún cuestionario, en papel o en línea, sustituye eso.

Un resultado "con indicadores" no significa que el niño tenga TDAH. Un resultado "sin indicadores" no significa que no lo tenga. Si tienes una preocupación, consulta de todos modos.

## Instrumento y versión

- **Escala principal:** NICHQ Vanderbilt Assessment Scale – Parent Informant (informante padre/madre), **1.ª edición (2002), versión en español**, © 2002 American Academy of Pediatrics y National Initiative for Children's Healthcare Quality. NICHQ distribuye esta edición gratuitamente y pide que se le cite como fuente. Usamos sus ítems y sus reglas de puntuación sin modificarlos. Las ediciones posteriores (2.ª y 3.ª) son de pago y no se usan.
- **Ítems Atento:** 18 preguntas adicionales escritas por el proyecto. Aparecen marcadas como "ítem Atento" y **no** forman parte de la escala Vanderbilt ni cambian su resultado. Sirven para investigar, con un socio académico, si un cuestionario más corto o más adaptado a Honduras funciona igual de bien. Mientras no estén validados, su puntaje se muestra por separado y con esa advertencia.
- **Versión del cuestionario:** cada respuesta guarda el número de versión del cuestionario (por ejemplo `q-1.0`). Si en el futuro cambiamos un ítem, cambia la versión y los datos antiguos no se mezclan con los nuevos sin indicarlo.

## Cómo se calcula el resultado (en lenguaje simple)

1. Cada una de las 18 preguntas de síntomas de la escala Vanderbilt se responde con "nunca", "a veces", "a menudo" o "muy a menudo". Solo cuentan como presentes las respuestas "a menudo" y "muy a menudo".
2. Las primeras 9 preguntas describen **inatención**; las otras 9, **hiperactividad/impulsividad**. Si hay 6 o más presentes en un grupo, ese grupo se considera positivo.
3. La escala también pregunta por el **funcionamiento** del niño (rendimiento escolar, relaciones). El criterio original de la escala exige que al menos un área esté marcada como problemática ("algo problemático" o "problemático"), además de los síntomas, para considerar el cribado positivo.
4. El resultado que ve la familia es una de tres frases: *"No se observan indicadores suficientes"*, *"Se observan indicadores de inatención / de hiperactividad-impulsividad / de ambos"*, siempre seguidas de la recomendación de consultar si hay preocupación.
5. Las preguntas de la escala sobre conducta oposicionista, conducta disocial y ansiedad/depresión se muestran y se puntúan según la regla publicada, pero el resultado las presenta solo como "otros indicadores a comentar con el profesional", sin etiquetas.
6. No hay inteligencia artificial, ni ponderaciones ocultas, ni ajustes por municipio: la misma respuesta siempre da el mismo resultado. El código que hace el cálculo es público y cualquiera puede revisarlo.

## Cómo se construye el mapa

**Qué se guarda de cada cuestionario.** Municipio (elegido por la persona), edad en años, sexo, quién responde (madre, padre, otro cuidador), las respuestas, la versión del cuestionario y la fecha. Nada más. No pedimos nombre, correo, teléfono ni fecha de nacimiento, y no guardamos la dirección IP de forma persistente.

**Agregación.** El mapa agrupa los cuestionarios por **municipio** y por **periodo** (año calendario). Para cada municipio y año se calcula: número de cuestionarios (n), número con resultado "con indicadores" y el porcentaje que representan.

**Supresión de municipios pequeños.** Si un municipio tiene **menos de 5 cuestionarios** en el periodo, no mostramos su porcentaje; aparece como "datos insuficientes". Con tan pocas respuestas el porcentaje no significa nada (una sola familia lo cambiaría de 0 % a 50 %) y además podría permitir que alguien dedujera quién respondió.

**Intervalo de confianza.** Junto a cada porcentaje mostramos un rango (intervalo de confianza de Wilson al 95 %): es el margen dentro del cual estaría el porcentaje "real" de ese grupo de respuestas si se repitiera la recolección muchas veces, y es más ancho cuanto menos cuestionarios haya. Usamos el método de Wilson porque funciona bien con números pequeños y con porcentajes cercanos a 0 % o 100 %, donde el método clásico falla.

**Escala de colores fija de 5 clases.** El color de cada municipio depende del porcentaje con indicadores:

| Clase | Porcentaje con indicadores |
|---|---|
| 1 | menos de 5 % |
| 2 | de 5 % a menos de 10 % |
| 3 | de 10 % a menos de 15 % |
| 4 | de 15 % a menos de 20 % |
| 5 | 20 % o más |
| gris | datos insuficientes (n < 5) |

Los cortes son **fijos**: no cambian según los datos de cada año ni según el municipio. Así, el mismo color significa lo mismo en 2026 y en 2030, y en Tegucigalpa y en Yoro, y se puede comparar un año con otro sin que el mapa "se recalcule" y cambie de aspecto. Si los cortes se ajustaran automáticamente (como hacen muchos mapas), un municipio podría pasar de verde a rojo sin que nada hubiera cambiado en él, solo porque cambió el resto.

## Sesgo de autoselección: por qué el mapa NO es prevalencia

Las personas que responden Atento no son una muestra representativa de las familias hondureñas. Responden quienes llegan al sitio, y normalmente llega quien ya tiene una preocupación. Por eso el porcentaje de resultados "con indicadores" será casi siempre **mucho mayor** que la proporción real de niños con TDAH en ese lugar.

**Ejemplo.** Imagina un municipio con 1,000 niños de 6 a 12 años, de los cuales unos 50 (5 %) tienen TDAH. Una maestra comparte el enlace en un grupo de madres y responden 40 familias, la mayoría porque algo les preocupaba. De esas 40, 16 obtienen "con indicadores". El mapa mostrará 40 % para ese municipio. Eso no significa que el 40 % de los niños del municipio tenga TDAH: significa que, **entre quienes decidieron responder**, el 40 % obtuvo indicadores. El mismo municipio, si el enlace lo compartiera un centro de salud a todas las familias de un control de niño sano, podría mostrar 8 %.

Lo que sí puede decir el mapa:
- cuántas familias de cada zona están usando la herramienta (demanda de información);
- qué proporción de quienes se preocupan obtiene indicadores;
- cómo cambia eso de un año a otro en el mismo lugar, si la forma de difusión se mantiene parecida.

Lo que no puede decir: cuántos niños tienen TDAH en Honduras ni en ningún municipio. Para eso hace falta un estudio con muestreo aleatorio y evaluación clínica, que es parte de lo que buscamos construir con un socio académico.

El título del mapa dirá siempre "Porcentaje de cuestionarios con indicadores" y nunca "prevalencia de TDAH".

## Históricos anuales y versionado de datos

- Los datos se cierran por **año calendario**. Cada 31 de diciembre se congela el conjunto de ese año y se publica como una versión (por ejemplo `datos-2026-v1`) con fecha de corte y un código de verificación (hash) para que cualquiera pueda comprobar que no se ha modificado.
- Si se detecta un error y hay que corregir una versión ya publicada, se publica una nueva (`v2`) y se explica el cambio en un registro público; la versión anterior no se borra.
- El mapa permite ver cada año por separado y la serie de un municipio a lo largo del tiempo. No se mezclan años salvo que se indique explícitamente.
- Cuando cambie la versión del cuestionario, los años con cuestionarios distintos se marcarán como "no directamente comparables".

## Cómo citar

Formato sugerido:

> Atento (2026). *Mapa de indicadores de riesgo de TDAH en niños de 6–12 años, Honduras. Conjunto de datos `datos-AAAA-vN`.* https://atento.galexbh.dev. Instrumento: NICHQ Vanderbilt Assessment Scale – Parent Informant, 1.ª ed. (2002), © American Academy of Pediatrics y NICHQ. Consultado el [fecha].

Si usas los datos, indica la versión exacta y reproduce la advertencia de que no representan prevalencia. Si publicas un análisis, agradeceremos que nos lo cuentes a info@galexbh.dev para enlazarlo.

## Cómo reportar errores

- **Errores en el cuestionario, la puntuación o el mapa:** escribe a info@galexbh.dev con el asunto "Error Atento" o abre un reporte en el repositorio público del código (enlace en el pie de página). Describe qué esperabas, qué viste y, si puedes, la fecha y el navegador.
- **Errores en la lista de recursos** (un centro que ya no existe, un teléfono equivocado): mismo correo, asunto "Recursos". Corregimos y registramos la fecha de la corrección.
- **Preocupaciones éticas o de privacidad:** mismo correo, asunto "Privacidad". Si el proyecto cuenta ya con comité de ética del socio académico, se indicará aquí cómo contactarlo directamente.
- Respondemos en un plazo razonable; los cambios que afectan a datos publicados se registran en el historial de versiones.

## Limitaciones en una lista

1. Es un cribado, no un diagnóstico.
2. Lo responde una sola persona, desde casa, sin la mirada de la escuela.
3. La escala Vanderbilt fue validada en Estados Unidos; su traducción al español no tiene aún validación publicada en Honduras ni en Latinoamérica.
4. Los ítems Atento no están validados todavía.
5. Quien responde se autoselecciona: el mapa refleja preocupación, no prevalencia.
6. El municipio lo elige la persona; no se verifica.
7. Municipios con pocas respuestas no se muestran.
8. No se registra acceso a tratamiento ni resultado posterior, así que no sabemos qué pasó después del cribado.
