# Registro de cambios

Todos los cambios notables de Atento se documentan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/). Los cambios que afectan a datos publicados
se anotan además en la política de datos abiertos.

## [Unreleased]

### Ítems faltantes unificados (2026-10-12)
- La puntuación sigue la regla del documento de puntuación: hasta 1 faltante por escala de síntomas o comorbilidad; desempeño incompleto si falta la mitad o más; sin nivel si las dos escalas de síntomas quedan incompletas.

### Versión para docentes (2026-10-12)
- Nuevo instrumento `vanderbilt-docente-es-1.0`: NICHQ Vanderbilt Assessment Scale – Teacher Informant, 1.ª edición (2002), versión en español (© 2005, OHSU como fuente), 43 ítems `T01–T43` verificados contra la fuente; reglas de NICHQ (inatención e hiperactividad ≥ 6 de 9, oposición/conducta combinada ≥ 3 de 10 guardada en `conducta`, ansiedad/depresión ≥ 3 de 7, desempeño ≥ 1 ítem con 4–5). Detalle y dudas para el asesor en `docs/02-instrumento/version-docente.md`.
- Flujo `/docente` (presentación indexable) → consentimiento docente (versión `2026-10-12`) → datos de la escuela → cuestionario (7 páginas) → hoja imprimible con el resumen de SUS respuestas, sin nivel ni interpretación. Sin la casilla de investigación no se envía nada.
- `/resultado`: «Invitar al docente» comparte `https://atento.galexbh.dev/docente?codigo=XXXXXXXX` (sin ningún dato del resultado). El código se normaliza, es opcional y se guarda en `codigo_vinculo`. No existe ningún endpoint que devuelva respuestas por código.
- `/cribado/datos` ya no ofrece «Docente» en «¿Quién responde?»; `EsquemaEnvio` rechaza `informante: "docente"` con el instrumento de padres y exige `docente` (sin `respuestasAtento`) con el instrumento docente. `POST /api/respuesta` responde sin `nivel` para el docente.
- Las respuestas docentes no cuentan en la publicación pública ni en la versión `todas` de `agregados_municipio` (filtro por `version_instrumento`); el panel sí las ve.
- Panel: reporte «Concordancia padre–docente» con kappa de Cohen (nuevo en `estadistica.ts`), Pearson con IC y criterio de dos entornos; desempeño, puntajes y calidad entienden el instrumento docente; microdatos con `T01–T43` y `par_id` (nunca el código); codebook actualizado.
- Lógica de cliente compartida: `motor-cuestionario.ts` y `components/Cuestionario.astro` (familia y docente), claves `atento:docente:*` (incluidas en «Borrar mis datos»), clave de Turnstile en `lib/compartido/turnstile-sitio.ts`.
- Migración `0005_codigo_vinculo_indice.sql` (índice parcial). Service worker `v2` con el flujo docente. `/docente` en sitemap, pie, portada y `llms.txt`.

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

### Verificación antibots (2026-10-12)
- Verificación antibots activa en el envío de cuestionarios, con comprobaciones adicionales en el servidor.

### Seguridad y privacidad (2026-10-12)
- Correcciones derivadas de una revisión de seguridad interna.
- Anonimización reforzada en las exportaciones para investigación y supresión de grupos pequeños también en totales.
- Botón "Borrar mis datos de este dispositivo" y caducidad del resultado guardado a 30 días.

### Pendiente

- Revisión clínica de los textos que ven las familias (cuestionario, resultado, avisos).
- Revisión legal de las páginas de `/legal/*` (marcadas como borrador 0.1).
- Confirmación de la línea de emergencia y recursos de salud mental en Honduras.
- Icono `maskable` a sangre completa para el manifest (el actual tiene esquinas transparentes).
- Validación en Honduras de la traducción de la escala y de los ítems Atento (socio académico).
- Revisión clínica de la versión docente (regla de desempeño de la 1.ª frente a la 2.ª edición, escala combinada de oposición/conducta) y revisión legal del consentimiento docente.
- El consentimiento de la familia ya no menciona a docentes: tienen su propio formulario y consentimiento.

## [0.1.0] - 2026-10-11

Primera versión funcional.

### Añadido

- Landing (`/`) con explicación de qué es un cribado, cómo funciona, privacidad en tres frases y
  preguntas frecuentes.
- Flujo de cribado: consentimiento informado (`/cribado/consentimiento`), datos no identificables
  del niño o niña (`/cribado/datos`) y cuestionario (`/cribado/cuestionario`) con la escala NICHQ
  Vanderbilt para padres, 1.ª ed. (2002), más 18 ítems Atento puntuados por separado. Progreso
  guardado en `localStorage` y envío opcional con verificación antibots.
- Página de resultado (`/resultado`) con aviso de salud, nivel orientativo, gráfico por área,
  alertas, código de vínculo para el docente y descarga en PDF. No indexable.
- API para recibir cuestionarios (validación estricta, puntuación en servidor, sin hora exacta ni
  identificadores) y para consultar estadísticas agregadas.
- Agregados por municipio y periodo con supresión `n < 5`, intervalo de Wilson 95 %, cron diario y
  snapshot anual congelado.
- Panel de investigación de acceso restringido con reportes y exportación de agregados.
- Páginas legales (`/legal/*`): términos, privacidad, aviso de salud, cookies y almacenamiento,
  accesibilidad, datos abiertos, créditos y licencias. Metodología pública (`/metodologia`) y
  contacto.
- Cabeceras de seguridad y protecciones habituales para aplicaciones web.
- SEO y descubribilidad: sitemap (`@astrojs/sitemap`) sin rutas de flujo ni privadas, `robots.txt`,
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
