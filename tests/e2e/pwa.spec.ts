import { expect, test } from "@playwright/test";

/**
 * PWA ligera: manifest, service worker y página sin conexión.
 *
 * El SW solo se registra en build (`import.meta.env.PROD`), así que las pruebas de registro y de
 * modo sin conexión se saltan contra `astro dev`. Para ejecutarlas contra la build:
 *   pnpm build
 *   pnpm preview                      # en otra terminal (http://127.0.0.1:8787)
 *   E2E_URL=http://127.0.0.1:8787 pnpm test:e2e pwa
 * (En Windows, no ejecutes `build` y `preview` a la vez.)
 */

const URL_PREVIEW = process.env.E2E_URL;
const CONTRA_BUILD = Boolean(URL_PREVIEW);

test.describe("PWA", () => {
  if (URL_PREVIEW) test.use({ baseURL: URL_PREVIEW });

  test("el manifest es válido y sus iconos existen", async ({ request }) => {
    const r = await request.get("/manifest.webmanifest");
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toMatch(/manifest\+json|application\/json/);
    const manifest = (await r.json()) as {
      name: string;
      short_name: string;
      lang: string;
      start_url: string;
      display: string;
      background_color: string;
      theme_color: string;
      icons: { src: string; sizes: string; type: string; purpose?: string }[];
    };
    expect(manifest.name).toContain("Atento");
    expect(manifest.short_name).toBe("Atento");
    expect(manifest.lang).toBe("es-HN");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.background_color.toLowerCase()).toBe("#f7f4ee");
    expect(manifest.theme_color.toLowerCase()).toBe("#1f6f8b");
    const tamanos = manifest.icons.map((i) => i.sizes);
    expect(tamanos).toContain("192x192");
    expect(tamanos).toContain("512x512");
    for (const icono of manifest.icons) {
      const ri = await request.get(icono.src);
      expect(ri.status(), icono.src).toBe(200);
      expect(ri.headers()["content-type"], icono.src).toContain("image/png");
    }
  });

  test("las páginas enlazan el manifest y declaran theme-color claro/oscuro", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );
    const temas = page.locator('meta[name="theme-color"]');
    await expect(temas).toHaveCount(2);
    await expect(temas.nth(0)).toHaveAttribute("media", "(prefers-color-scheme: light)");
    await expect(temas.nth(1)).toHaveAttribute("media", "(prefers-color-scheme: dark)");
  });

  test("sw.js se sirve como JavaScript y nunca cachea /api ni /admin", async ({ request }) => {
    const r = await request.get("/sw.js");
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toMatch(/javascript/);
    const codigo = await r.text();
    expect(codigo).toContain('"/api/"');
    expect(codigo).toContain('"/admin"');
    expect(codigo).toContain("atento-cola");
    expect(codigo).toContain("atento-envio");
    expect(codigo).toContain('"/offline"');
  });

  test("la página /offline existe, es amable y no se indexa", async ({ page }) => {
    const r = await page.goto("/offline");
    expect(r?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("conexión");
    await expect(page.getByRole("link", { name: "Ir al inicio" })).toBeVisible();
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots).toContain("noindex");
  });

  test("en dev no se registra el service worker (solo en build)", async ({ page }) => {
    test.skip(CONTRA_BUILD, "Contra la build el SW sí se registra; ver la prueba siguiente");
    await page.goto("/");
    const registro = page.locator("script[nonce]", { hasText: "serviceWorker" });
    await expect(registro).toHaveCount(0);
  });

  test("contra la build el service worker se registra y sirve /offline sin red", async ({
    page,
    context,
  }) => {
    test.skip(!CONTRA_BUILD, "Requiere `pnpm build` + `pnpm preview` y E2E_URL (ver cabecera)");
    await page.goto("/");
    const estado = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return { scope: reg.scope, activo: Boolean(reg.active) };
    });
    expect(estado.activo).toBe(true);
    expect(estado.scope.endsWith("/")).toBe(true);
    // Da tiempo al precache del app shell y comprueba el modo sin conexión.
    await page.waitForTimeout(1500);
    await context.setOffline(true);
    try {
      await page.goto("/ruta-que-no-esta-en-cache");
      await expect(page.getByRole("heading", { level: 1 })).toContainText("conexión");
    } finally {
      await context.setOffline(false);
    }
  });
});
