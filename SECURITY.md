# Política de seguridad de Atento

Atento es un sitio comunitario de cribado (no diagnóstico) de TDAH infantil. No guarda datos
identificables, pero sí respuestas de familias y agregados públicos, así que tomamos en serio
cualquier fallo que pueda exponer datos, alterar resultados o afectar la disponibilidad.

## Cómo reportar una vulnerabilidad

- Escribe a **info@galexbh.dev** con el asunto `Seguridad Atento`. Si prefieres, usa la pestaña
  *Security → Report a vulnerability* del repositorio en GitHub (reporte privado).
- Incluye: descripción, pasos para reproducir, URL o archivo afectado, impacto que estimas y, si
  lo tienes, una prueba de concepto. Idiomas: español o inglés.
- Por favor **no abras un issue público** para vulnerabilidades. La plantilla de issue
  "Seguridad" existe solo para redirigirte aquí.
- Archivo legible por máquinas: <https://atento.galexbh.dev/.well-known/security.txt> (RFC 9116).

## Alcance

Dentro del alcance:

- El sitio <https://atento.galexbh.dev> y el entorno de pruebas <https://atento-preview.galexbh.dev>.
- La API pública (`/api/respuesta`, `/api/agregado`, `/api/geo`), el panel `/admin` y el Worker
  de Cloudflare (`src/`, `migrations/`, `wrangler.jsonc`).
- El service worker (`public/sw.js`) y la cola de envíos sin conexión.
- Cualquier forma de reidentificar a una persona a partir de los datos agregados publicados
  (por ejemplo, saltarse la supresión `n < 5`).

Fuera del alcance:

- Infraestructura de terceros (Cloudflare, GitHub) salvo que la configuración sea nuestra.
- Ingeniería social, phishing, acceso físico, denegación de servicio volumétrica.
- Reportes de escáneres automáticos sin prueba de impacto, cabeceras "recomendadas" sin
  consecuencia práctica, o versiones de dependencias sin vector explotable.

## Qué no hacer

- No accedas, modifiques ni descargues datos que no sean tuyos; si durante una prueba ves datos
  de otras personas, detente y repórtalo.
- No ejecutes pruebas que degraden el servicio (fuerza bruta masiva, fuzzing agresivo contra
  producción). Usa el entorno de preview o un despliegue local (`pnpm dev`).
- No envíes respuestas falsas al mapa para probar algo: contaminan los agregados. Usa
  `pnpm seed` en local.
- No publiques el hallazgo antes de que esté corregido o hayan pasado 90 días desde el reporte.

## Tiempos de respuesta orientativos

Atento lo mantiene una persona sin equipo de guardia; estos plazos son de buena fe, no un SLA.

| Hito | Plazo orientativo |
| --- | --- |
| Acuse de recibo | 5 días hábiles |
| Evaluación inicial y severidad | 10 días hábiles |
| Corrección de un fallo crítico (exposición de datos, ejecución remota) | lo antes posible, objetivo 14 días |
| Corrección de fallos medios o bajos | siguiente versión, objetivo 90 días |
| Divulgación coordinada | tras la corrección, con crédito si lo deseas |

No hay programa de recompensas económicas. Con tu permiso te acreditamos en `CHANGELOG.md` y
en `public/humans.txt`.

## Buenas prácticas que ya aplicamos

- CSP estricta con nonce por petición, HSTS, `frame-ancestors 'none'` y verificación de `Origin`
  en la API (`src/middleware.ts`).
- Sin datos identificables: ni nombre, ni correo, ni IP persistente (solo hash con sal y TTL de
  1 hora para el límite de envíos).
- Validación estricta de entradas con `zod`, Turnstile y honeypot en el envío.
- Dependencias fijadas y actualizadas por Renovate con `minimumReleaseAge` de 3 días.
