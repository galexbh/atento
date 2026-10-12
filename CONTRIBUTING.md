# Cómo contribuir a Atento

Gracias por querer ayudar. Atento es un proyecto personal sin fines de lucro; cualquier mejora
(código, textos, revisión clínica, recursos de Honduras, accesibilidad) es bienvenida. Antes de
empezar, lee el [Código de conducta](./CODE_OF_CONDUCT.md).

## Principio innegociable

**Cribar no es diagnosticar.** Ningún cambio puede hacer que Atento parezca una herramienta
diagnóstica, sugiera tratamientos, o pida datos que identifiquen a una persona. Si tu idea roza
alguno de estos puntos, abre un issue primero para conversarlo.

## Preparar el entorno

Requisitos: Node 24+ y pnpm 12 (`corepack enable` lo instala a partir de `packageManager`).
Usa siempre `pnpm`, nunca `npm` ni `yarn`.

```bash
pnpm install                     # dependencias + hooks de git (lefthook)
cp .dev.vars.example .dev.vars   # secretos locales
pnpm db:migrate:local            # esquema en la D1 local
pnpm dev                         # http://localhost:4321
```

## Calidad: Biome y lefthook

- Lint y formato con **Biome** (`biome.json`). No hay Prettier ni ESLint; no añadas configuración
  de otras herramientas.
  - `pnpm lint` comprueba; `pnpm lint:fix` arregla lo que sea seguro; `pnpm format` solo formatea.
- **lefthook** instala dos hooks al hacer `pnpm install`:
  - `pre-commit`: `biome check --staged --write` (arregla y vuelve a añadir lo corregido).
  - `pre-push`: `pnpm test` (unitarias).
- Tipos y diagnósticos de Astro: `pnpm check`.

## Correr las pruebas

| Comando | Qué cubre |
| --- | --- |
| `pnpm test` | Unitarias en Node (`tests/unit`): puntuación, agregación, validación. |
| `pnpm test:workers` | Dentro de workerd con D1 migrada (`tests/workers`): API y crons. |
| `pnpm test:e2e` | Playwright + axe (`tests/e2e`), móvil y escritorio, contra `astro dev`. |
| `pnpm build` | Compila a `dist/`; genera también el sitemap. |

Antes de abrir un PR deja en verde `pnpm lint`, `pnpm check`, `pnpm test`, `pnpm build` y, si
tocaste páginas, `pnpm test:e2e`. En Windows no ejecutes `pnpm build` y `pnpm preview` a la vez.
La primera vez, instala el navegador: `pnpm exec playwright install chromium`. Las pruebas de
service worker (`tests/e2e/pwa.spec.ts`) solo corren contra la build: `pnpm build`, luego
`pnpm preview` en otra terminal y `E2E_URL=http://127.0.0.1:8787 pnpm test:e2e pwa`.

## Convenciones

- **Idioma**: código, comentarios, commits, issues y documentación en **español** (identificadores
  en español sin tildes: `puntuar`, `agregarMunicipio`). Las claves de API y nombres de librerías
  quedan como están.
- **Commits**: una línea en imperativo, corta y concreta, opcionalmente con ámbito:
  `cuestionario: guarda el progreso cada 10 s`, `docs: aclara la supresión n < 5`,
  `fix: evita doble envío al pulsar dos veces`. Explica el *porqué* en el cuerpo si no es obvio.
- **Ramas**: `tipo/descripcion-corta` (`fix/doble-envio`, `docs/metodologia`). Los PR van a `main`.
- **Accesibilidad**: WCAG 2.1 AA. Las pruebas e2e fallan con violaciones serias de axe.
- **Seguridad**: los scripts inline llevan `nonce={Astro.locals.nonce}`; no añadas dominios a la
  CSP sin justificarlo en el PR. Nunca registres datos identificables ni IPs.
- **Dependencias**: fijadas (sin `^`). Renovate propone actualizaciones; evita añadir dependencias
  para cosas que se resuelven en 20 líneas.

## Revisión clínica obligatoria

Todo texto que ve una familia o un docente (preguntas del cuestionario, textos de resultado,
avisos de salud, consentimiento, recomendaciones, recursos de Honduras, páginas legales) requiere
**revisión de una persona con criterio clínico** (pediatría, psicología o psiquiatría infantil)
antes de fusionarse. En el PR marca la casilla correspondiente y nombra a quien revisó; si aún no
hay revisión, el PR se etiqueta `pendiente-revision-clinica` y no se despliega a producción.

Los ítems de la escala NICHQ Vanderbilt (1.ª ed., 2002) **no se modifican**: ni redacción ni
reglas de puntuación. Los "ítems Atento" sí pueden cambiar, con versión nueva del instrumento.

## Reportar errores y proponer cambios

- Usa las plantillas de issue (error, texto confuso, recurso de referencia).
- Vulnerabilidades: **no** abras un issue; sigue [SECURITY.md](./SECURITY.md).
- PR pequeños y con un solo propósito. Describe qué cambia, por qué y cómo lo probaste
  (la plantilla de PR te guía).

## Licencias de lo que aportas

Al contribuir aceptas que tu código se publique bajo MIT y tus textos, datos o ítems bajo
CC BY 4.0 (ver [LICENSE](./LICENSE)). No aportes material de terceros sin licencia compatible.
