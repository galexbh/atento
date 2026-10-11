---
titulo: "Política de privacidad de Atento"
version: "Versión 0.1 — 11 de octubre de 2026 — borrador pendiente de revisión legal"
---

## 1. Responsable del tratamiento

`[CONFIRMAR nombre completo del titular]`, persona natural, Honduras, a título personal.
Correo: `info@galexbh.dev`.
Sitio: `https://atento.galexbh.dev`.

## 2. Marco legal

Honduras no tiene todavía una ley general de protección de datos personales. El anteproyecto de Ley de Protección de Datos Personales, impulsado por el IAIP desde 2015 y socializado en el Congreso Nacional en 2024, seguía pendiente de dictamen en 2026. `[CONFIRMAR estado legislativo a la fecha de publicación]`

Mientras tanto, Atento se guía por:

- El **artículo 182 de la Constitución de la República**, que reconoce la garantía de **habeas data**: toda persona puede acceder a la información sobre sí misma o su familia que conste en archivos públicos o privados, y pedir su rectificación, actualización, confidencialidad o eliminación. `[CONFIRMAR cita literal con la versión vigente de la Constitución y la Ley sobre Justicia Constitucional, Decreto 244-2003 y reformas]`
- El **artículo 76 de la Constitución**, que garantiza el derecho al honor, a la intimidad personal y familiar y a la propia imagen.
- Los principios internacionales de protección de datos: minimización, finalidad, consentimiento, transparencia y seguridad.

La Ley de Transparencia y Acceso a la Información Pública (Decreto 170-2006) solo aplica a entes públicos; no aplica a Atento.

Si entra en vigor una ley de datos personales, esta política se actualizará para cumplirla.

## 3. Qué datos recogemos

Cuando completas el cuestionario, el sitio guarda únicamente:

| Dato | Ejemplo | Para qué |
|---|---|---|
| Departamento y municipio | Cortés, San Pedro Sula | Mapa nacional |
| Edad del niño o niña en años | 8 | Resultado y estadísticas |
| Sexo del niño o niña | masculino / femenino | Resultado y estadísticas |
| Tipo de informante | madre, padre, docente, otro | Interpretación del resultado |
| Respuestas al cuestionario | valores 0–3 por ítem | Resultado y estadísticas |
| Fecha (sin hora) | 2026-10-11 | Versionado de datos |
| Duración aproximada | 9 minutos | Calidad de datos |
| Versión del instrumento y del consentimiento | v1 / 2026-10-11 | Trazabilidad |

Además, de forma temporal y técnica:

- **Hash de tu dirección IP con sal**, que caduca en 1 hora. Sirve solo para limitar envíos repetidos. No permite recuperar tu IP.
- **Token de Cloudflare Turnstile** para comprobar que no eres un bot. Lo gestiona Cloudflare.

## 4. Qué datos NO recogemos

- Nombre del niño, niña o adulto.
- Fecha de nacimiento.
- Correo electrónico, teléfono o dirección.
- Dirección IP en claro.
- Ubicación GPS.
- Identificadores del dispositivo o huella del navegador.
- Cookies de rastreo o publicidad.
- Cuentas de usuario (no existen).

## 5. Para qué usamos los datos (finalidades)

1. **Mostrarte el resultado inmediato.** Las respuestas se procesan para calcular el resultado del cribado. Esto es necesario para que el sitio funcione.
2. **Investigación y estadísticas públicas.** Solo si marcas la casilla opcional de consentimiento, tus respuestas anónimas se guardan en la base de datos para alimentar el mapa nacional y los datos abiertos.

Si no marcas la casilla opcional, el servidor no conserva tus respuestas después de darte el resultado. `[CONFIRMAR con el agente técnico que así está implementado]`

## 6. Base del tratamiento: tu consentimiento

Tratamos los datos porque tú lo autorizas en la pantalla de consentimiento (ver `consentimiento-informado.md`). El consentimiento para investigación es **separado, opcional y específico**. Puedes negarlo y aun así usar el cribado.

## 7. Anonimización y k-anonimato, en lenguaje simple

**Anonimización** significa que guardamos los datos sin nada que permita saber quién los envió. No hay nombre, correo, IP ni cuenta. Ni siquiera nosotros podemos saber qué respuesta es tuya.

**k-anonimato** es una regla para publicar estadísticas sin exponer a nadie. Solo publicamos cifras de un municipio cuando hay **al menos 5 respuestas** en él. Si un municipio tiene menos de 5, su dato se oculta o se agrupa con el departamento. Así nadie puede deducir que "la única respuesta de este pueblo" es la de una familia concreta.

Los microdatos (fila por fila) nunca se publican. Solo se comparten con un socio académico bajo acuerdo escrito y aval de un comité de ética (ver sección 10).

## 8. Cuánto tiempo guardamos los datos

| Dato | Plazo |
|---|---|
| Respuestas anonimizadas (con consentimiento de investigación) | Indefinido, mientras exista el proyecto, por su valor para investigación |
| Hash temporal de IP | 1 hora, luego se borra automáticamente |
| Progreso del cuestionario y tema visual (localStorage) | Lo controlas tú: queda en tu navegador hasta que lo borres o termines el cuestionario |
| Token Turnstile | Solo durante el envío |

## 9. Dónde están los datos y quién los trata

- **Cloudflare, Inc.** actúa como **encargado del tratamiento**. Atento funciona sobre Cloudflare Workers, D1 (base de datos) y KV (almacenamiento temporal). Los datos se guardan en la red global de Cloudflare, que puede incluir centros de datos fuera de Honduras, principalmente en Estados Unidos y Europa. Cloudflare está sujeto a sus propios términos y a su acuerdo de procesamiento de datos. `[CONFIRMAR que el titular aceptó el DPA de Cloudflare y la región de D1 configurada]`
- **Cloudflare Web Analytics** mide visitas sin cookies ni identificadores de persona.
- **Socio académico futuro** (ver sección 10).

No vendemos datos. No usamos datos para publicidad.

## 10. Transferencias internacionales

Al guardarse en Cloudflare, los datos salen de Honduras. Honduras no tiene hoy un régimen legal de transferencias internacionales. Mitigamos el riesgo porque:

- Los datos son anónimos desde su origen.
- Cloudflare aplica cifrado en tránsito y en reposo y cumple normas internacionales de seguridad.

## 11. Destinatarios: socio académico

Atento puede compartir **microdatos anonimizados** con una universidad o centro de investigación, únicamente si:

1. Hay un acuerdo escrito (ver `acuerdo-socio-academico-plantilla.md`).
2. El estudio cuenta con aval de un comité de ética de investigación.
3. El socio se compromete a no reidentificar a nadie.

El nombre del socio se publicará en el sitio cuando exista.

## 12. Tus derechos y cómo ejercer el habeas data

Tienes derecho a saber qué datos tratamos, a pedir corrección o eliminación, y a retirar el consentimiento. Escribe a `info@galexbh.dev` con el asunto "Habeas data".

**Importante:** como no guardamos nombre, correo, IP ni ningún identificador, **no podemos localizar una respuesta concreta** a partir de tus datos personales. La única forma de ubicarla es el **código de vínculo** que el sitio te muestra al terminar el cuestionario, si decidiste conservarlo. Si nos envías ese código, podemos eliminar esa fila de la base de datos. Sin el código, la respuesta es indistinguible de cualquier otra y no puede borrarse de forma selectiva, pero tampoco puede vincularse contigo.

Los datos agregados ya publicados en versiones anteriores de los datasets no se pueden retirar, porque no identifican a nadie.

Responderemos en un plazo máximo de 30 días. `[CONFIRMAR plazo razonable; la Ley sobre Justicia Constitucional fija plazos para el recurso judicial, no para la vía directa]`

Si no quedas conforme, puedes acudir a los tribunales mediante la garantía de habeas data (art. 182 de la Constitución).

## 13. Menores de edad

Atento trata datos **sobre** niños y niñas de 6 a 12 años, pero **nunca los recoge de ellos directamente**. La información la aporta un adulto responsable, que declara serlo en el consentimiento. Los datos del menor son anónimos: edad en años, sexo y respuestas. No hay nombre ni fecha de nacimiento.

Los docentes solo deben usar el sitio con autorización de la familia.

## 14. Seguridad

Medidas resumidas:

- Cifrado HTTPS en todas las conexiones.
- Minimización: no recogemos lo que no necesitamos.
- Hash de IP con sal, caducidad automática en 1 hora.
- Cloudflare Turnstile y límites de tasa contra envíos automatizados.
- Acceso a la base de datos restringido al titular, con autenticación de Cloudflare. `[CONFIRMAR si hay 2FA en la cuenta de Cloudflare]`
- Código abierto: cualquiera puede revisar cómo se tratan los datos.
- Supresión de celdas pequeñas (menos de 5) antes de publicar.

Si ocurre un incidente de seguridad que afecte datos, lo publicaremos en el sitio y en el repositorio en un plazo de 72 horas desde que lo conozcamos.

## 15. Cambios de esta política

Cada versión tiene número y fecha. El historial completo está en el repositorio público. Si un cambio amplía el uso de los datos, pediremos consentimiento nuevo; nunca aplicaremos un uso nuevo a datos recogidos con una versión anterior del consentimiento.

### Historial de versiones

| Versión | Fecha | Cambios |
|---|---|---|
| 0.1 | 2026-10-11 | Borrador inicial, pendiente de revisión legal |

## 16. Contacto

`info@galexbh.dev`
