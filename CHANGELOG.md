# Registro de cambios

Todos los cambios notables de Atento se documentan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/). Los cambios que afectan a datos publicados
se anotan además en la política de datos abiertos.

## [Unreleased]

### Mapa público /datos (2026-10-12)
- Página `/datos` y `/datos/<año>` con mapa por departamento (% con indicadores, n de respuestas y comparación entre años), tablas, serie trimestral nacional y descargas CSV/JSON (CC BY 4.0).
- Publicación segura: solo años completos, supresión primaria n<5 y complementaria en tres niveles; versión v1 inmutable al cerrar el año.
- La preliminar del año en curso solo incluye trimestres cerrados y solo departamentos, para impedir ataques por diferencia entre versiones sucesivas.
- `/api/agregado` endurecido: ya no publica meses, trimestres, acumulado ni municipios sin supresión complementaria.

### Datos abiertos: mapa nacional (2026-10-11)
- Página pública `/datos` (año más reciente) y `/datos/AAAA` (informe anual): mapa por departamento
  con modos % con indicadores, número de respuestas y cambio frente a otro año; tabla por
  departamento, municipios plegables, serie trimestral nacional, tabla departamento × año y
  descargas CSV/JSON con licencia CC BY 4.0. Funciona sin JavaScript; paletas nuevas `--dv-*`.
- API `GET /api/publico/datos?anio=` (JSON/CSV con BOM, ETag/304) y `GET /api/publico/anios`.
- Nueva regla de publicación: solo año calendario, supresión primaria (n < 5 sin mostrar n) y
  complementaria (municipios, departamentos y trimestres), serie solo nacional, 1 decimal, solo
  respuestas con consentimiento de investigación.
- Migración `0004_publicaciones.sql`: publicaciones versionadas (`preliminar` del año en curso,
  `v1` inmutable al cerrar el año), regeneradas por `recalcularAgregados`/cron.
- **Cambio incompatible:** `/api/agregado` solo acepta `periodo` = año y `version=todas`, delega en
  la publicación segura (`n: null` en celdas suprimidas, `pctAmbas: null`); `/api/agregado/periodos`
  solo lista años. Ya no se publican meses, trimestres, acumulado ni municipios sin supresión
  complementaria.
- Enlaces "Datos" en cabecera y pie; la portada enlaza al mapa; `/datos` en el sitemap y `llms.txt`.

### Turnstile (2026-10-12)
- Widget real integrado en preview y producción; secreto validado y guardado sin exponerlo.
- El servidor exige `action` y `hostname` además de `success`; tokens de hasta 2048 caracteres.

### Seguridad (2026-10-12, revisión interna)
- Neutralizada la inyección de fórmulas CSV en exportaciones; `versionConsentimiento` con formato de fecha.
- Microdatos: filtros finos prohibidos, umbral de recodificación sobre el universo, id seudonimizado por descarga, k-anonimato por cruce.
- Supresión n<5 también en totales; auditoría de consultas; límites de granularidad para el rol investigador.
- Verificación estricta de origen en POST de `/admin`; `worker-src` y `manifest-src` en la CSP.
- `RATE_SALT` obligatoria en producción (HMAC de IP); `ADMIN_SESSION_SECRET` obligatorio; cierre global de sesiones.
- PBKDF2 a 100 000 iteraciones (límite de Cloudflare Workers); Turnstile fail-closed fuera de local.
- Cabeceras para estáticos, CI con permisos mínimos y auditoría de dependencias, triggers de validación en D1.
- Botón "Borrar mis datos de este dispositivo" y caducidad del resultado a 30 días.

### Pendiente

- Revisión clínica de los textos que ven las familias (cuestionario, resultado, avisos).
- Revisión legal de las páginas de `/legal/*` (marcadas como borrador 0.1).
- Confirmación de la línea de emergencia y recursos de salud mental en Honduras.
- Icono `maskable` a sangre completa para el manifest (el actual tiene esquinas transparentes).
- Validación en Honduras de la traducción de la escala y de los ítems Atento (socio académico).

## [0.1.0] - 2026-10-11

Primera versión funcional, desplegable en Cloudflare Workers.

### Añadido

- Landing (`/`) con explicación de qué es un cribado, cómo funciona, privacidad en tres frases y
  preguntas frecuentes.
- Flujo de cribado: consentimiento informado (`/cribado/consentimiento`), datos no identificables
  del niño o niña (`/cribado/datos`) y cuestionario (`/cribado/cuestionario`) con la escala NICHQ
  Vanderbilt para padres, 1.ª ed. (2002), más 18 ítems Atento puntuados por separado. Progreso
  guardado en `localStorage` y envío opcional con Turnstile y honeypot.
- Página de resultado (`/resultado`) con aviso de salud, nivel orientativo, gráfico por área,
  alertas, código de vínculo para el docente y descarga en PDF. No indexable.
- API: `POST /api/respuesta` (validación estricta `zod`, límite 5 envíos/hora/IP con hash y sal,
  puntuación en servidor, fecha sin hora), `GET /api/agregado`, `GET /api/agregado/periodos`,
  `GET /api/geo` y `GET /api/salud`.
- Agregados por municipio y periodo con supresión `n < 5`, intervalo de Wilson 95 %, cron diario y
  snapshot anual congelado.
- Panel de administración (`/admin`) con resumen, geografía, demografía, calidad, desempeño,
  comorbilidad y exportación de agregados.
- Páginas legales (`/legal/*`): términos, privacidad, aviso de salud, cookies y almacenamiento,
  accesibilidad, datos abiertos, créditos y licencias. Metodología pública (`/metodologia`) y
  contacto.
- Seguridad: CSP estricta con nonce por petición, HSTS, verificación de `Origin` en la API, modo
  mantenimiento.
- SEO y descubribilidad: sitemap (`@astrojs/sitemap`) sin rutas de flujo ni admin, `robots.txt`,
  JSON-LD `WebSite`/`Organization`, `BreadcrumbList` (legal y metodología) y `FAQPage` en la
  portada, `llms.txt` y `llms-full.txt`, `humans.txt`, `security.txt` (RFC 9116).
- PWA ligera: `manifest.webmanifest`, `theme-color` claro/oscuro, service worker con app shell,
  modo sin conexión (`/offline`) y cola de envíos en IndexedDB con Background Sync.
- Accesibilidad: WCAG 2.1 AA verificada con axe en las pruebas e2e; modo oscuro y
  `prefers-reduced-motion`.
- Calidad: Biome, lefthook, Renovate, Vitest (Node y workerd), Playwright, CI en GitHub Actions.
- Documentación: marco clínico, instrumento, legal, metodología pública, recursos de Honduras,
  propuesta a socio académico, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, plantillas
  de issue y PR.

[Unreleased]: https://github.com/galexbh/atento/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/galexbh/atento/releases/tag/v0.1.0
