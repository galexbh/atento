# Atento

Sitio comunitario de **cribado (no diagnóstico)** de TDAH infantil para Honduras.
Producción: <https://atento.galexbh.dev> · Contacto: <info@galexbh.dev>

## Qué es

Atento ofrece a madres, padres, cuidadores y docentes un cuestionario breve y gratuito sobre
señales de inatención, hiperactividad y conducta en niñas y niños de 6 a 12 años. Al terminar,
muestra una orientación clara sobre cuándo conviene consultar con un profesional de salud y
publica, de forma agregada y anónima, estadísticas por municipio que ayudan a dimensionar la
necesidad de atención en el país.

**Principio rector: cribar no es diagnosticar.** Un resultado "alto" en Atento no significa que
el niño o la niña tenga TDAH; significa que vale la pena hablarlo con un pediatra, psicólogo o
psiquiatra infantil. El diagnóstico solo lo hace un profesional, con entrevista clínica y
valoración integral. Atento nunca recoge datos identificables (ni nombres, ni correos, ni
ubicación precisa): solo código de departamento y municipio, edad, sexo, quién responde y las
respuestas al cuestionario. Más detalle en `docs/`.

## Stack

| Capa          | Tecnología                                                                 |
| ------------- | -------------------------------------------------------------------------- |
| Framework     | [Astro 7](https://astro.build) (`output: "server"`), TypeScript `strict`     |
| Hospedaje     | Cloudflare Workers vía `@astrojs/cloudflare` (D1 + KV + Assets + Cron)     |
| Datos         | Cloudflare D1 (SQLite); migraciones en `migrations/`                       |
| Validación    | `zod`                                                                      |
| Calidad       | Biome (lint + formato), lefthook (hooks de git), Renovate                  |
| Pruebas       | Vitest (unitarias y dentro de workerd), Playwright + axe-core (e2e y a11y) |
| Antibots      | Cloudflare Turnstile (`TURNSTILE_SECRET`)                                   |

Gestor de paquetes: **pnpm 12** (siempre `pnpm`, nunca `npm`/`yarn`). Node 24+.

## Cómo correr en local

```bash
pnpm install                 # instala dependencias y los hooks de git (lefthook)
cp .dev.vars.example .dev.vars   # secretos locales (TURNSTILE_SECRET)
pnpm db:migrate:local        # crea el esquema en la D1 local (.wrangler/state)
pnpm dev                     # http://localhost:4321 (corre dentro de workerd, con D1/KV locales)
```

Otros comandos útiles:

| Comando             | Qué hace                                                             |
| ------------------- | -------------------------------------------------------------------- |
| `pnpm check`        | Tipos y diagnósticos de Astro (`astro check`)                        |
| `pnpm lint` / `lint:fix` / `format` | Biome                                                |
| `pnpm test`         | Pruebas unitarias (`tests/unit`)                                     |
| `pnpm test:workers` | Pruebas dentro del runtime de Workers con D1 migrada (`tests/workers`) |
| `pnpm test:e2e`     | Playwright (móvil Pixel 7 y escritorio) con auditoría axe (`tests/e2e`) |
| `pnpm build`        | Compila a `dist/` (`dist/server` = Worker, `dist/client` = estáticos)  |
| `pnpm preview`      | Sirve la build con `wrangler dev` (http://127.0.0.1:8787)            |
| `pnpm seed`         | Datos de ejemplo (`scripts/seed.ts`); ver "Datos de prueba"          |
| `pnpm agregar:local` | Recalcula los agregados en la D1 local (`scripts/agregar-local.ts`) |

## API y datos

| Ruta | Qué hace |
| ---- | -------- |
| `POST /api/respuesta` | Recibe un cuestionario (JSON ≤ 32 KB, `EsquemaEnvio` estricto), aplica el límite de 5 envíos/hora/IP justo después de validar (HMAC-SHA256 de la IP con `RATE_SALT` en KV, TTL 1 h; la IP nunca se guarda) y antes de consultar D1 o Turnstile, verifica Turnstile, puntúa **en servidor** y guarda en `respuestas` solo la fecha UTC (sin hora) y la duración redondeada a 10 s. Respuestas: 201 `{ok, nivel}`, 200 `{ok, duplicado}` si el id ya existía, 400 validación, 403 Turnstile, 413, 415, 429, 503 `{ok:false, motivo:"no_guardado"}` (D1) o `motivo:"configuracion"` (producción sin `RATE_SALT`). El honeypot `hp` relleno responde 201 sin guardar. |
| `GET /api/agregado?periodo=acumulado&nivel=departamento\|municipio&version=todas` | Lee solo `agregados_municipio` (nunca filas individuales). Caché KV 1 h, `Cache-Control: public, max-age=300, s-maxage=3600`, ETag/304. Respuesta `{periodo, nivel, version, calculadoEn, datos:[{codigo, nombre, n, pct, ic95, suprimido, pctInatencion, pctHiperactividad, pctAmbas}]}`. |
| `GET /api/agregado/periodos` | Periodos (`acumulado`, `2026`, `2026-Q4`, `2026-10`) y versiones de instrumento con agregados. |
| `GET /api/geo?nivel=departamento` | GeoJSON de departamentos incrustado en el Worker (`public/geo/...geojson?raw`), `application/geo+json`, caché de 1 día (7 en borde), ETag. |

**Agregados.** El cron diario (03:00 UTC, `src/worker.ts` → `src/lib/agregados/recalcular.ts`) recalcula
`agregados_municipio` desde `respuestas` (solo `completado = 1`) con la función pura `agregar()`
(`src/lib/agregados/calcular.ts`), escribe en lotes `batch`, borra lo obsoleto por `calculado_en`,
invalida la caché KV `agregado:*` y, cada 1 de enero, congela el año anterior en `agregados_anuales`
(`version_dataset = "v1"`, solo versión `todas`). `recalcularAgregados(env)` se exporta para el panel admin. Convenciones:

- `pct_combinado` = % con inatención **o** hiperactividad positiva ("con indicadores"; lleva el IC de Wilson 95 %);
  `pct_ambas` (migración 0002) = % con las dos a la vez. Porcentajes en 0–100 con dos decimales.
- Supresión: `n < 5` → `suprimido = 1`, porcentajes e IC en `NULL`, se conserva `n`.
- Filas por departamento: `municipio = departamento + "00"` (p. ej. `0800` = Francisco Morazán); ningún
  municipio real usa ese código. `nivel=departamento` en la API devuelve `codigo` de 2 dígitos.
- Se agrega por cada `version_instrumento` y, además, por `todas`.
- Turnstile solo en `ENTORNO=local` sin `TURNSTILE_SECRET` (o con la clave de prueba de Cloudflare):
  se acepta cualquier token y no se llama a siteverify. En preview y producción el secreto real es
  obligatorio; si falta o es la clave de prueba, toda verificación falla.
- `RATE_SALT` (secreto): sal del HMAC de IP del límite de tasa y de los intentos de `/admin/entrar`.
  Obligatoria en producción (`/api/respuesta` responde 503 `configuracion` si falta); en local/preview,
  si falta, se deriva de la fecha UTC.

## Datos de prueba

```bash
pnpm db:migrate:local          # esquema (migraciones 0001 y 0002)
pnpm seed -- --n 2000          # respuestas sintéticas -> .wrangler/seed.sql -> D1 local (idempotente por semilla)
pnpm agregar:local             # recalcula agregados_municipio en la D1 local e invalida la KV local
pnpm build && pnpm preview     # http://127.0.0.1:8787
curl "http://127.0.0.1:8787/api/agregado?periodo=acumulado&nivel=departamento"
```

`pnpm seed` acepta `--semilla 42` (distinta semilla = distintos ids), `--solo-sql` (solo genera el archivo)
y `--archivo ruta`. `pnpm agregar:local` acepta `--snapshot 2025` para crear el snapshot anual. Para
disparar el cron real en local: `pnpm build && pnpm exec wrangler dev --test-scheduled` y luego
`curl "http://127.0.0.1:8787/__scheduled?cron=0+3+*+*+*"`.

Para probar `POST /api/respuesta` con `pnpm preview` (que toma `ENTORNO=produccion` de `wrangler.jsonc`),
pon en `.dev.vars` `ENTORNO=local` y `RATE_SALT=<cualquier cadena>`: con `ENTORNO=local` se acepta la
clave de prueba de Turnstile `TURNSTILE_SECRET=1x0000000000000000000000000000000AA` sin llamar a
siteverify. Fuera de `local` la clave de prueba se rechaza.

## Despliegue

Antes del primer despliegue, un administrador de la cuenta de Cloudflare crea los recursos y
pega los IDs en `wrangler.jsonc` (los pasos exactos están comentados al inicio de ese archivo):

```bash
pnpm exec wrangler d1 create atento-db
pnpm exec wrangler kv namespace create CACHE
pnpm exec wrangler secret put TURNSTILE_SECRET        # clave real de Turnstile
pnpm exec wrangler secret put RATE_SALT               # p. ej. openssl rand -hex 32 (obligatoria en producción)
pnpm exec wrangler secret put ADMIN_SESSION_SECRET    # obligatoria en producción (cookie /admin y microdatos)
pnpm exec wrangler secret put ADMIN_PASSWORD_HASH     # solo ADMIN_MODO=password; hash PBKDF2 de 100 000 iteraciones
```

### Turnstile

- Widget: "atento.galexbh.dev (Spin)", modo administrado, clave de sitio `0x4AAAAAAFUM2SiQtialMd1m`.
  Dominios permitidos: `atento.galexbh.dev`, `atento-preview.galexbh.dev`, `localhost`, `127.0.0.1`.
- La clave de sitio está en `src/pages/cribado/cuestionario.astro` y se usa en cualquier build;
  `astro dev` usa la clave de pruebas de Cloudflare. `PUBLIC_TURNSTILE_SITE_KEY` la sustituye.
- El widget se renderiza con `action: "envio-respuesta"` y el servidor exige esa acción y que
  `hostname` sea el host de `SITE_URL` (`localhost`/`127.0.0.1` solo con `ENTORNO=local`).
- Rotar el secreto sin mostrarlo: leerlo con `wrangler turnstile widget get <sitekey> --json`
  a una variable de shell, probarlo contra siteverify con un token ficticio (debe responder
  `invalid-input-response`) y pasarlo por stdin a `wrangler secret put TURNSTILE_SECRET`
  (y `--env preview`).

El hash de `ADMIN_PASSWORD_HASH` se genera con `pnpm tsx scripts/hash-password.ts "contraseña"`.
Usa 100 000 iteraciones PBKDF2: el runtime de Cloudflare Workers rechaza valores mayores
(`NotSupportedError: iteration counts above 100000 are not supported`), así que un hash de 200 000
iteraciones funciona en local pero hace fallar el login en la nube; `verificarContrasena` lo
rechaza y lo avisa en los registros.

Luego:

```bash
pnpm db:migrate:prod        # aplica migraciones a la D1 remota
pnpm deploy                 # build + wrangler deploy  -> https://atento.galexbh.dev
pnpm deploy:preview         # entorno preview          -> https://atento-preview.galexbh.dev
```

La CI (`.github/workflows/ci.yml`) ejecuta lint, tipos, pruebas, build, un `wrangler deploy
--dry-run` y las pruebas e2e en cada push y PR a `main`. Renovate mantiene las dependencias
fijadas y espera 3 días antes de proponer versiones nuevas (igual que `minimumReleaseAge` de pnpm).

## Seguridad

`src/middleware.ts` añade a todas las respuestas una CSP estricta con nonce por petición
(`Astro.locals.nonce`, con `worker-src` y `manifest-src` limitados a `'self'`), HSTS en los dominios
de producción y preview, y el resto de cabeceras habituales. `public/_headers` (formato de
Cloudflare Workers Static Assets) añade `nosniff`/`Referrer-Policy` a los estáticos, `CSP: sandbox`
a `/ilustraciones/*` y `/marca/*` (SVG) y caché de un día a `/geo/*`. Anti-CSRF
(`src/lib/api/origen.ts`): en `/api/*` se rechaza con 403 cualquier petición cuyo `Origin` no
coincida con `SITE_URL`; en todo POST bajo `/admin` y `/api/admin` la comprobación es estricta (si
falta `Origin` se usa `Sec-Fetch-Site`; sin ambas se rechaza fuera de `local`). La cookie de sesión
del panel lleva `Path=/` y `SameSite=Strict`, incluye `iat` y el botón "Cerrar todas las sesiones"
de `/admin/sistema` escribe `configuracion.sesiones_no_antes_de` para invalidar las emitidas antes.
La fila `mantenimiento = '1'` de la tabla `configuracion` activa un 503 global
(excepto `/admin*`), con caché en memoria de 60 segundos.

Panel y microdatos: todos los conteos (incluidos los totales) se publican con supresión `n < 5`;
el rol investigador no puede combinar `municipio` con edad, sexo, informante ni periodos mensuales,
y cada consulta a `/api/admin/reporte/*` queda en `auditoria_admin` (acción `consulta`). La
exportación de microdatos solo admite periodo anual o acumulado, departamento y versión del
instrumento; el `id` es un seudónimo HMAC distinto en cada descarga, el municipio se recodifica
con el umbral calculado sobre todo el periodo y se aplica k-anonimato sobre
(departamento, edad, sexo, informante): edad a tramo y, si sigue `n < 5`, sexo e informante en
blanco (ver el codebook). Los CSV neutralizan fórmulas (`=`, `+`, `-`, `@`, TAB, CR al inicio).
La migración `0003` añade un trigger `BEFORE INSERT` en `respuestas` que exige `items` JSON válido,
`codigo_vinculo` de 8 caracteres (o NULL) y `version_consentimiento` con formato `AAAA-MM-DD`.

## Estructura de carpetas

```
.
├── .github/workflows/   CI
├── docs/                Documentación del proyecto (metodología, instrumento, privacidad...)
├── migrations/          Migraciones D1 (SQL), numeradas
├── public/              Estáticos (marca, imágenes, robots, llms.txt, manifest, sw.js, .well-known)
├── scripts/             Utilidades (seed)
├── src/
│   ├── data/            Catálogos (departamentos, municipios, ítems del instrumento)
│   ├── layouts/         Base.astro
│   ├── lib/             Lógica de dominio (puntuación, validación, agregados)
│   ├── pages/           Rutas (index, /api/salud, ...)
│   ├── styles/          global.css (tokens de color, modo oscuro, reduced-motion)
│   ├── env.d.ts         Tipos de bindings (Env) y de Astro.locals
│   ├── middleware.ts    Cabeceras de seguridad, Origin, mantenimiento
│   └── worker.ts        Entrada del Worker (fetch -> Astro, scheduled -> crons)
├── tests/
│   ├── unit/            Vitest en Node
│   ├── workers/         Vitest dentro de workerd (D1 real, migraciones aplicadas)
│   └── e2e/             Playwright + axe
├── astro.config.mjs · wrangler.jsonc · biome.json · lefthook.yml · playwright.config.ts
└── vitest.config.ts · vitest.workers.config.ts · tsconfig.json · pnpm-workspace.yaml
```

Documentación ampliada en [`docs/`](./docs/).

## SEO y descubribilidad

- `astro.config.mjs` fija `site` y configura `@astrojs/sitemap`: como el sitio es `output: "server"`,
  solo entran las rutas estáticas y `/legal/*` se añade con `customPages`; se excluyen `/resultado`,
  `/cribado/*`, `/admin/*`, `/api/*` y `/offline`. El sitemap se genera en `pnpm build` en
  `dist/client/sitemap-index.xml` y se sirve como estático.
- `public/robots.txt` permite todo salvo `/api/`, `/admin/`, `/resultado` y `/cribado/`.
- `src/layouts/Base.astro` emite JSON-LD `WebSite` + `Organization` en las páginas indexables y
  `BreadcrumbList` en `/legal/*` y `/metodologia`; la portada añade `FAQPage` con las preguntas del
  `<details>`. No se usan tipos `Medical*`: Atento es cribado comunitario, no un servicio médico.
  El componente `src/components/seo/JsonLd.astro` inserta los bloques con el nonce de la CSP.
- Archivos para asistentes y auditores: `public/llms.txt` (resumen con enlaces, formato
  llmstxt.org), `public/llms-full.txt` (aviso de salud + metodología completa, generado a partir de
  `docs/06-metodologia-publica.md`; actualízalo cuando cambie ese documento), `public/humans.txt` y
  `public/.well-known/security.txt` (RFC 9116; renueva `Expires` cada año).
- Las páginas de flujo y el resultado llevan `noindex`. `tests/e2e/seo.spec.ts` verifica robots,
  sitemap, JSON-LD, Open Graph, canonical, `noindex` y que cada título mida ≤ 60 y cada descripción
  ≤ 160 caracteres.

## PWA y modo sin conexión

- `public/manifest.webmanifest`: nombre, `lang: es-HN`, `display: standalone`, colores de la paleta
  (`#F7F4EE` fondo, `#1F6F8B` tema) e iconos 192/512 (`public/marca/`). `Base.astro` enlaza el
  manifest y declara `theme-color` para claro y oscuro.
- `public/sw.js` (service worker, sin dependencias): precachea el app shell (`/`, flujo de cribado,
  `/resultado`, `/offline`), sirve las navegaciones *network-first* con fallback a `/offline` y los
  recursos del mismo origen *stale-while-revalidate*. **Nunca cachea `/api/*` ni `/admin/*`.**
- Cola de envíos: si `POST /api/respuesta` falla por red, el cuerpo (sin datos identificables) se
  guarda en IndexedDB (`atento-cola`) y se reintenta con Background Sync (tag `atento-envio`) o en
  el siguiente arranque del SW. El cliente recibe `503 {ok:false, motivo:"en_cola"}` y el resultado
  queda marcado como no guardado (nunca se afirma un guardado que no ocurrió). Un reintento puede
  ser rechazado por el servidor si el token de Turnstile venció; los 4xx se descartan.
- El SW se registra desde `Base.astro` solo en build (`import.meta.env.PROD`), nunca en `astro dev`.
  Para probarlo: `pnpm build`, luego `pnpm preview` y
  `E2E_URL=http://127.0.0.1:8787 pnpm test:e2e pwa` (`tests/e2e/pwa.spec.ts`). Para invalidar la
  caché en producción, sube `VERSION` en `sw.js`.

## Licencias

| Qué | Licencia |
| --- | --- |
| Código fuente | [MIT](./LICENSE), © 2026 Gabriel Barrientos (galexbh) |
| Datos agregados publicados e ítems Atento | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| NICHQ Vanderbilt Assessment Scale, 1.ª ed. (2002) | © American Academy of Pediatrics y NICHQ; no cubierta por las anteriores |
| Nombre y logotipo de Atento | Reservados; se pueden citar, no usar para suplantar el sitio |

Detalle y créditos de imágenes en [`docs/03-legal/creditos-y-licencias.md`](./docs/03-legal/creditos-y-licencias.md)
y en <https://atento.galexbh.dev/legal/creditos>.

## Contribuir y seguridad

- Cómo contribuir, convenciones y revisión clínica obligatoria: [`CONTRIBUTING.md`](./CONTRIBUTING.md).
- Código de conducta: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).
- Reporte responsable de vulnerabilidades: [`SECURITY.md`](./SECURITY.md) y
  <https://atento.galexbh.dev/.well-known/security.txt>. No abras issues públicos para ello.
- Historial de versiones: [`CHANGELOG.md`](./CHANGELOG.md).

## Contacto

Proyecto personal sin fines de lucro. Dudas, sugerencias o reportes: <info@galexbh.dev>.
