# Declaración de accesibilidad

Versión 0.1 — 11 de octubre de 2026 — borrador pendiente de revisión legal

## 1. Compromiso

Atento quiere que cualquier familia o docente de Honduras pueda usar el sitio, sin importar su capacidad, su dispositivo o la calidad de su conexión. Nos comprometemos a cumplir las **Pautas de Accesibilidad para el Contenido Web (WCAG) 2.1, nivel AA**.

Honduras cuenta con la Ley de Equidad y Desarrollo Integral para las Personas con Discapacidad (Decreto 160-2005), que promueve la accesibilidad. `[CONFIRMAR si alguna norma hondureña exige un estándar web concreto a sitios privados; en general no aplica a un proyecto personal, pero el compromiso es voluntario]`

## 2. Qué se ha hecho

`[El agente de implementación debe actualizar esta lista con lo realmente hecho]`

- Estructura semántica: encabezados ordenados, listas y formularios etiquetados.
- Navegación completa por teclado, con foco visible.
- Contraste de color mínimo 4.5:1 en texto y 3:1 en componentes.
- Texto redimensionable hasta 200 % sin pérdida de contenido.
- Textos alternativos en imágenes e ilustraciones con significado.
- Modo claro y oscuro, respetando la preferencia del sistema.
- Cuestionario con una pregunta por pantalla o bloques cortos, con progreso visible y posibilidad de retomar.
- Lenguaje claro: frases cortas, sin jerga clínica innecesaria.
- Sin límites de tiempo para responder.
- Sin contenido que parpadee.
- Compatible con lectores de pantalla (NVDA, VoiceOver, TalkBack). `[CONFIRMAR pruebas realizadas]`
- Funciona en móviles de gama baja y con conexiones lentas.
- Cloudflare Turnstile se ejecuta, en lo posible, sin desafío visual; cuando hay desafío, ofrece alternativa accesible.

## 3. Limitaciones conocidas

`[Completar tras la auditoría]`

- El mapa interactivo puede no ser plenamente operable con lector de pantalla. Como alternativa, los mismos datos se ofrecen en tabla y en descarga CSV.
- Ejemplo: `[…]`

## 4. Cómo reportar una barrera

Si encuentras algo que no puedes usar, escríbenos a `info@galexbh.dev` con:

- Qué intentabas hacer.
- Qué pasó.
- Dispositivo, navegador y, si usas, tecnología de apoyo.

Respondemos en un plazo de 10 días hábiles e intentamos corregir en la siguiente versión. También puedes abrir un reporte en el repositorio público del proyecto.

## 5. Evaluación

- Método: autoevaluación con herramientas automáticas (axe, Lighthouse) y pruebas manuales con teclado y lector de pantalla. `[CONFIRMAR]`
- Fecha de la última evaluación: `[pendiente]`.
- Esta declaración se revisa al menos una vez al año.
