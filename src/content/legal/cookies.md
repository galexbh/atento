---
titulo: "Cookies y almacenamiento en tu navegador"
version: "Versión 0.1 — 11 de octubre de 2026 — borrador pendiente de revisión legal"
---

## 1. Resumen

Atento **no usa cookies de rastreo ni de publicidad**, ni analítica de terceros con identificadores. Solo usa almacenamiento local mínimo y necesario para que el sitio funcione.

## 2. Inventario exacto

### 2.1 localStorage (en tu dispositivo)

| Clave | Contenido | Finalidad | Duración | Se envía al servidor |
|---|---|---|---|---|
| `atento:progreso` `[CONFIRMAR nombre de clave con el agente técnico]` | Respuestas en curso del cuestionario | Que no pierdas el avance si cierras la pestaña | Hasta que termines el cuestionario o lo borres | No |
| `atento:tema` `[CONFIRMAR]` | `claro` / `oscuro` / `sistema` | Recordar tu preferencia visual | Hasta que lo borres | No |
| `atento:consentimiento` `[CONFIRMAR si existe]` | Versión del consentimiento aceptado | No volver a mostrar la pantalla en la misma sesión | Hasta que lo borres | Solo la versión, junto con las respuestas |

Puedes borrar todo desde la configuración de tu navegador ("borrar datos del sitio") o con el botón "Borrar mi progreso" del sitio. `[CONFIRMAR que existe el botón]`

### 2.2 Cloudflare Turnstile (antibots)

- Comprueba que eres una persona antes de enviar el cuestionario.
- Puede crear una cookie técnica propia de Cloudflare (`cf_clearance` u otra) o usar almacenamiento aislado durante el desafío. Es estrictamente necesaria para la seguridad del sitio.
- No se usa para rastrear tu actividad en otros sitios.
- Más información: política de privacidad de Cloudflare.

### 2.3 Cloudflare Web Analytics

- Mide visitas, páginas vistas y rendimiento.
- **No usa cookies ni localStorage**, no crea huella del dispositivo ni identificadores de persona.
- Los datos que recibe Cloudflare son agregados.

### 2.4 Lo que NO hay

- Google Analytics, Meta Pixel u otros rastreadores.
- Cookies de sesión de usuario (no hay cuentas).
- Cookies de publicidad.
- Fuentes o scripts de terceros que rastreen. `[CONFIRMAR con el agente técnico que las fuentes se sirven localmente]`

## 3. Por qué no hay banner de cookies

Un banner se exige, en los países que lo regulan, cuando se usan cookies **no necesarias** (rastreo, publicidad, analítica con identificadores). Atento solo usa:

- Almacenamiento **estrictamente necesario** para que el cuestionario funcione (progreso) o para una preferencia que tú eliges (tema).
- Una protección antibots necesaria para la seguridad.
- Analítica **sin cookies ni identificadores**.

Además, Honduras no tiene hoy una norma que exija banner de cookies. Por transparencia, esta página explica todo lo que se guarda, y la política de privacidad lo recoge también. Si el marco legal cambia o se añade cualquier tecnología de rastreo, se añadirá un mecanismo de consentimiento.

## 4. Contacto

`info@galexbh.dev`
