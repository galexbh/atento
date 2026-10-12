import { expect, test } from "@playwright/test";

/**
 * Regresión de CSP contra la build real. En `astro dev` los scripts se sirven como módulos y la
 * CSP nunca los bloquea; en la build, Astro podía incrustar scripts pequeños sin nonce y el
 * navegador los bloqueaba (p. ej. el botón de tema). Ejecutar con:
 *   pnpm build && pnpm preview   # en otra terminal
 *   E2E_URL=http://127.0.0.1:8787 pnpm exec playwright test csp
 */
const URL_BUILD = process.env.E2E_URL;

const PAGINAS = [
  "/",
  "/cribado/consentimiento",
  "/cribado/datos",
  "/cribado/cuestionario",
  "/resultado",
  "/datos",
  "/metodologia",
  "/docente",
  "/docente/cuestionario",
  "/legal/privacidad",
  "/admin/entrar",
];

test.describe("CSP en la build", () => {
  test.skip(!URL_BUILD, "Requiere `pnpm build` + `pnpm preview` y E2E_URL (ver cabecera)");

  test("ninguna página tiene scripts bloqueados por la CSP", async ({ page }) => {
    const bloqueos: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && /Content Security Policy/i.test(m.text())) {
        bloqueos.push(`${page.url()}: ${m.text().slice(0, 120)}`);
      }
    });
    for (const ruta of PAGINAS) {
      await page.goto(`${URL_BUILD}${ruta}`);
      await page.waitForLoadState("networkidle");
    }
    expect(bloqueos).toEqual([]);
  });

  test("el botón de tema alterna y recuerda la preferencia", async ({ page }) => {
    await page.goto(`${URL_BUILD}/`);
    const tema = () => page.evaluate(() => document.documentElement.dataset.theme ?? null);
    await page.locator("[data-tema]").first().click();
    const primero = await tema();
    expect(primero === "dark" || primero === "light").toBe(true);
    await page.locator("[data-tema]").first().click();
    const segundo = await tema();
    expect(segundo).not.toBe(primero);
    await page.reload();
    expect(await tema()).toBe(segundo);
  });
});
