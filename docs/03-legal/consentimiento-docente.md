# Consentimiento de la versión docente (pantalla previa al cuestionario)

Versión 0.1 — 12 de octubre de 2026 — borrador pendiente de revisión legal

```yaml
versionConsentimiento: "2026-10-12"
```

Pantalla: `/docente/consentimiento` (`src/pages/docente/consentimiento.astro`). Se guarda en el
dispositivo como `atento:docente:consentimiento` y, si (c) está marcada, se envía
`versionConsentimiento: "2026-10-12"` junto con la respuesta.

## 1. Texto de introducción

> **Antes de empezar**
>
> Este cuestionario toma de 5 a 8 minutos. Es un **cribado**, no un diagnóstico. Al terminar verá una hoja con el resumen de sus respuestas para entregar a la familia o al profesional de salud. **No verá un nivel ni un resultado.**
>
> No le pedimos su nombre, el del niño o niña ni el de la escuela. Marque las casillas para continuar.

## 2. Confirmaciones

(a) y (b) son obligatorias. (c) es opcional y aparece **desmarcada** por defecto.

### (a) Obligatoria — Docente con autorización de la familia

> ☐ Soy docente del niño o niña y la familia me pidió o autorizó completar este cuestionario. Entiendo que Atento es un cribado y **no un diagnóstico**.

### (b) Obligatoria — Términos y privacidad

> ☐ He leído y acepto los [Términos y condiciones](/legal/terminos) y la [Política de privacidad](/legal/privacidad).

### (c) Opcional — Investigación

> ☐ **Opcional.** Autorizo que mis respuestas, de forma anónima, se usen para investigación.

## 3. Qué implica la casilla (c)

> Si marca esta casilla, guardamos sus respuestas en una base de datos **sin nada que identifique**: solo departamento y municipio de la escuela, edad en años y sexo del niño o niña, que responde un docente, las respuestas, la fecha, la duración aproximada y, si la familia se lo dio, el código de vínculo.
>
> El código de vínculo solo sirve para comparar, de forma anónima y agrupada, lo que ven las familias y los docentes. Nadie puede consultar las respuestas de otra persona con ese código.
>
> Las respuestas de docentes **no se suman al mapa público** para no contar dos veces al mismo niño. Los datos fila por fila nunca se publican; solo podrían compartirse con una universidad o centro de investigación, bajo acuerdo escrito y aval de un comité de ética, y siempre anónimos.
>
> Los datos se guardan en Cloudflare, en servidores que pueden estar fuera de Honduras.
>
> Puede pedir que borremos su respuesta escribiendo a `info@galexbh.dev` con el código de vínculo que usó. Sin código no podemos saber cuál es la suya.
>
> Si no marca la casilla, nada sale de este dispositivo: solo se genera la hoja para imprimir.

## 4. Botón de continuar

> [Continuar]

Solo se activa con (a) y (b) marcadas.

## 5. Datos que registra el sistema

Si (c) está marcada: `informante: "docente"`, `instrumentoId: "vanderbilt-docente-es-1.0"`,
`versionConsentimiento: "2026-10-12"`, `consentimientoInvestigacion: true`, departamento y
municipio de la escuela, edad, sexo, respuestas, duración y `codigoVinculo` si lo hay. Si (c) no
está marcada, **no se envía nada al servidor** (igual que en el flujo de la familia).

## 6. Pantalla final

Hoja imprimible con el texto obligatorio: «Para entregar a la familia o al profesional de salud.
No es un diagnóstico ni un resultado.» Sin nivel ni interpretación.

## 7. Puntos `[CONFIRMAR]` para el abogado

1. Si la autorización verbal o escrita de la familia que declara el docente en (a) es suficiente, o
   si debe exigirse algo más (por ejemplo, que la familia comparta el enlace con código).
2. Si el docente actúa en nombre propio o de la institución educativa, y si hace falta aval de la
   dirección del centro o de la Secretaría de Educación para responder sobre un alumno.
3. Si el tratamiento del municipio de la escuela junto con edad y sexo puede, en escuelas pequeñas,
   identificar al niño (las filas docentes no se publican, pero sí entran en los microdatos con
   las mismas reglas de k-anonimato).
4. Si conviene una página legal propia para docentes o basta con esta pantalla y las secciones
   correspondientes de la política de privacidad y los términos (opción actual).
