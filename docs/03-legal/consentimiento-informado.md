# Consentimiento informado (pantalla previa al cuestionario)

Versión 0.1 — 11 de octubre de 2026 — borrador pendiente de revisión legal

```yaml
versionConsentimiento: "2026-10-11"
```

## 1. Texto de introducción

> **Antes de empezar**
>
> Este cuestionario toma unos 10 minutos. Es un **cribado**, no un diagnóstico. Al final verás un resultado orientativo y una recomendación sobre si conviene consultar a un profesional.
>
> No te pedimos nombre, correo ni ningún dato que te identifique. Lee y marca las casillas para continuar.

## 2. Confirmaciones

Las casillas (a) y (b) son obligatorias. La casilla (c) es opcional y debe aparecer **desmarcada** por defecto.

### (a) Obligatoria — Soy el adulto responsable

> Los docentes usan su propio formulario y consentimiento (`consentimiento-docente.md`).
>
> ☐ Confirmo que soy mayor de 18 años y que soy madre, padre, tutor o responsable del niño o niña. Entiendo que Atento es un cribado y **no un diagnóstico**, y que no sustituye la evaluación de un profesional de salud.

### (b) Obligatoria — Términos y privacidad

> ☐ He leído y acepto los [Términos y condiciones](/terminos) y la [Política de privacidad](/privacidad).

### (c) Opcional — Investigación y estadísticas públicas

> ☐ **Opcional.** Autorizo que mis respuestas, de forma anónima, se usen para investigación y para estadísticas públicas del mapa nacional de Atento.
>
> [¿Qué implica esto?](#que-implica-c) — Puedes usar el cribado aunque no marques esta casilla.

## 3. Qué implica la casilla (c) {#que-implica-c}

> Si marcas esta casilla, guardamos tus respuestas en una base de datos **sin nada que te identifique**: solo departamento y municipio, edad en años y sexo del niño o niña, quién responde (madre, padre, docente u otro), las respuestas, la fecha y la duración aproximada. No guardamos nombre, correo, IP ni ubicación exacta.
>
> Con esos datos publicamos **estadísticas agregadas** en un mapa de Honduras, bajo licencia abierta (CC BY 4.0). Para proteger a las familias, solo mostramos cifras de un municipio cuando hay al menos 5 respuestas.
>
> Los datos fila por fila nunca se publican. Solo podrían compartirse con una universidad o centro de investigación, bajo acuerdo escrito y aval de un comité de ética, y siempre anónimos.
>
> Los datos se guardan en Cloudflare, en servidores que pueden estar fuera de Honduras.
>
> Puedes retirar tu consentimiento escribiendo a `info@galexbh.dev`. Como no sabemos qué respuesta es tuya, solo podremos borrarla si conservas el **código de vínculo** que te mostraremos al terminar.
>
> Si no marcas la casilla, tus respuestas se usan solo para calcular tu resultado y no se conservan.

(Unas 185 palabras.)

## 4. Botón de continuar

> [Empezar el cuestionario]

El botón solo se activa cuando (a) y (b) están marcadas.

## 5. Datos que debe registrar el sistema

Junto con las respuestas, si (c) está marcada:

- `versionConsentimiento: "2026-10-11"`
- `consentimientoInvestigacion: true`
- Versión del instrumento.

Si (c) no está marcada, el servidor no debe persistir las respuestas. `[CONFIRMAR con el agente técnico]`

## 6. Pantalla final: código de vínculo

Al terminar, mostrar:

> Tu código de vínculo es **`XXXX-XXXX`**. Guárdalo si quieres poder pedir que borremos tu respuesta en el futuro. No lo compartas. Nosotros no lo guardamos junto a ningún dato tuyo.

`[CONFIRMAR con el agente técnico que el código se genera en el cliente o se deriva de forma que no permita reidentificación por terceros]`
