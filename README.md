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
| `POST /api/respuesta` | Recibe un cuestionario (JSON ≤ 32 KB, `EsquemaEnvio` estricto), verifica Turnstile, aplica límite de 5 envíos/hora/IP (hash SHA-256 de IP + sal en KV, TTL 1 h; la IP nunca se guarda), puntúa **en servidor** y guarda en `respuestas` solo la fecha UTC (sin hora) y la duración redondeada a 10 s. Respuestas: 201 `{ok, nivel}`, 200 `{ok, duplicado}` si el id ya existía, 400 validación, 403 Turnstile, 413, 415, 429, 503 `{ok:false, motivo:"no_guardado"}`. El honeypot `hp` relleno responde 201 sin guardar. |
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
- Turnstile en local/preview sin `TURNSTILE_SECRET`: se asume la clave de prueba de Cloudflare (acepta
  cualquier token) y no se llama a siteverify. En producción el secreto es obligatorio.
- `RATE_SALT` (var opcional): sal del hash de IP; si falta se deriva de la fecha UTC.

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

Para probar `POST /api/respuesta` con `pnpm preview` (que usa `ENTORNO=produccion` de `wrangler.jsonc`,
donde el secreto es obligatorio), pon en `.dev.vars` la clave de prueba de Turnstile
`TURNSTILE_SECRET=1x0000000000000000000000000000000AA` (acepta cualquier token; requiere red) o
`ENTORNO=local` (omite la llamada a siteverify).

## Despliegue

Antes del primer despliegue, un administrador de la cuenta de Cloudflare crea los recursos y
pega los IDs en `wrangler.jsonc` (los pasos exactos están comentados al inicio de ese archivo):

```bash
pnpm exec wrangler d1 create atento-db
pnpm exec wrangler kv namespace create CACHE
pnpm exec wrangler secret put TURNSTILE_SECRET
```

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
(`Astro.locals.nonce`), HSTS en los dominios de producción y preview, y el resto de cabeceras
habituales. En `/api/*` se rechaza con 403 cualquier petición cuyo `Origin` no coincida con
`SITE_URL`. La fila `mantenimiento = '1'` de la tabla `configuracion` activa un 503 global
(excepto `/admin*`), con caché en memoria de 60 segundos.

## Estructura de carpetas

```
.
├── .github/workflows/   CI
├── docs/                Documentación del proyecto (metodología, instrumento, privacidad...)
├── migrations/          Migraciones D1 (SQL), numeradas
├── public/              Estáticos (ilustraciones, imágenes, marca)
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

## Licencia y contacto

Proyecto personal sin fines de lucro. Dudas, sugerencias o reportes: <info@galexbh.dev>.
