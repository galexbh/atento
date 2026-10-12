import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";

/**
 * SEO y descubribilidad: robots, sitemap (generado en `pnpm build`), JSON-LD, Open Graph,
 * canonical, noindex en el flujo y límites de título/descripción en las páginas públicas.
 * Corre contra `astro dev`; el sitemap se lee de `dist/client` (se salta si no hay build).
 */

const SITIO = "https://atento.galexbh.dev";
const PAGINAS_PUBLICAS = [
  "/",
  "/metodologia",
  "/datos",
  "/contacto",
  "/legal/terminos",
  "/legal/privacidad",
  "/legal/aviso-de-salud",
  "/legal/cookies",
  "/legal/accesibilidad",
  "/legal/datos-abiertos",
  "/legal/creditos",
];
const PAGINAS_NOINDEX = [
  "/resultado",
  "/cribado/consentimiento",
  "/cribado/datos",
  "/cribado/cuestionario",
  "/offline",
];

async function leerJsonLd(page: Page): Promise<Record<string, unknown>[]> {
  const bloques = await page.locator('script[type="application/ld+json"]').allTextContents();
  return bloques.map((b) => JSON.parse(b) as Record<string, unknown>);
}

test.describe("SEO", () => {
  test("robots.txt permite el sitio, bloquea flujo/API/admin y enlaza el sitemap", async ({
    request,
  }) => {
    const r = await request.get("/robots.txt");
    expect(r.status()).toBe(200);
    const texto = await r.text();
    expect(texto).toContain("User-agent: *");
    expect(texto).toContain("Allow: /");
    for (const ruta of ["/api/", "/admin/", "/resultado", "/cribado/"]) {
      expect(texto).toContain(`Disallow: ${ruta}`);
    }
    expect(texto).toContain(`Sitemap: ${SITIO}/sitemap-index.xml`);
  });

  test("el sitemap generado en build solo contiene páginas públicas", async () => {
    const indice = resolve("dist/client/sitemap-index.xml");
    test.skip(
      !existsSync(indice),
      "Ejecuta `pnpm build` para generar dist/client/sitemap-index.xml",
    );
    const xmlIndice = readFileSync(indice, "utf8");
    expect(xmlIndice).toContain(`<loc>${SITIO}/sitemap-0.xml</loc>`);
    const xml = readFileSync(resolve("dist/client/sitemap-0.xml"), "utf8");
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] as string);
    for (const ruta of PAGINAS_PUBLICAS) {
      expect(urls, `falta ${ruta}`).toContain(`${SITIO}${ruta}`);
    }
    for (const url of urls) {
      expect(url, "URL excluida presente").not.toMatch(
        /\/(resultado|cribado|admin|api|offline)(\/|$)/,
      );
      expect(url.startsWith(`${SITIO}/`)).toBe(true);
      if (url !== `${SITIO}/`) expect(url.endsWith("/")).toBe(false);
    }
    expect(urls.length).toBe(PAGINAS_PUBLICAS.length);
  });

  test("la portada tiene JSON-LD válido (WebSite + FAQPage), og:image absoluto y canonical", async ({
    page,
  }) => {
    await page.goto("/");
    const bloques = await leerJsonLd(page);
    const tipos = bloques.map((b) => b["@type"]);
    expect(tipos).toContain("WebSite");
    expect(tipos).toContain("FAQPage");
    expect(tipos.some((t) => typeof t === "string" && t.startsWith("Medical"))).toBe(false);

    const sitio = bloques.find((b) => b["@type"] === "WebSite") as Record<string, unknown>;
    expect(sitio["@context"]).toBe("https://schema.org");
    expect(sitio.name).toBe("Atento");
    expect(sitio.inLanguage).toBe("es-HN");
    const publisher = sitio.publisher as Record<string, unknown>;
    expect(publisher["@type"]).toBe("Organization");
    expect(publisher.logo).toBe(`${SITIO}/marca/logo.svg`);
    expect((publisher.contactPoint as Record<string, unknown>).email).toBe("info@galexbh.dev");

    const faq = bloques.find((b) => b["@type"] === "FAQPage") as Record<string, unknown>;
    const preguntas = faq.mainEntity as Record<string, unknown>[];
    expect(preguntas.length).toBeGreaterThanOrEqual(5);
    // Las preguntas del JSON-LD son las mismas que las del <details> visible.
    const visibles = await page.locator("details.plegable summary").allTextContents();
    expect(preguntas.map((p) => p.name)).toEqual(visibles.map((v) => v.trim()));

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage).toMatch(new RegExp(`^${SITIO}/`));
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toBe(`${SITIO}/`);
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots).toContain("index");
    expect(robots).not.toContain("noindex");
    await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
  });

  test("legal y metodología llevan BreadcrumbList; el flujo no lleva JSON-LD", async ({ page }) => {
    for (const ruta of ["/metodologia", "/legal/privacidad"]) {
      await page.goto(ruta);
      const migas = (await leerJsonLd(page)).find((b) => b["@type"] === "BreadcrumbList") as
        | Record<string, unknown>
        | undefined;
      expect(migas, `sin BreadcrumbList en ${ruta}`).toBeDefined();
      const items = migas?.itemListElement as Record<string, unknown>[];
      expect(items[0]?.item).toBe(SITIO);
      expect(items[1]?.item).toBe(`${SITIO}${ruta}`);
    }
    await page.goto("/cribado/consentimiento");
    expect(await leerJsonLd(page)).toEqual([]);
  });

  test("resultado y flujo de cribado llevan noindex", async ({ page }) => {
    for (const ruta of PAGINAS_NOINDEX) {
      await page.goto(ruta);
      const robots = await page.locator('meta[name="robots"]').getAttribute("content");
      expect(robots, ruta).toContain("noindex");
    }
  });

  test("cada página pública tiene título único (≤ 60) y descripción (≤ 160)", async ({ page }) => {
    const titulos = new Map<string, string>();
    for (const ruta of PAGINAS_PUBLICAS) {
      const r = await page.goto(ruta);
      expect(r?.status(), ruta).toBe(200);
      const titulo = await page.title();
      const descripcion = await page.locator('meta[name="description"]').getAttribute("content");
      expect(titulo.length, `${ruta}: "${titulo}"`).toBeLessThanOrEqual(60);
      expect(titulo.length, ruta).toBeGreaterThan(0);
      expect(descripcion?.length ?? 0, `${ruta}: "${descripcion}"`).toBeLessThanOrEqual(160);
      expect(descripcion?.length ?? 0, ruta).toBeGreaterThan(20);
      expect(
        titulos.has(titulo),
        `título repetido "${titulo}" en ${ruta} y ${titulos.get(titulo)}`,
      ).toBe(false);
      titulos.set(titulo, ruta);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(canonical, ruta).toBe(`${SITIO}${ruta === "/" ? "/" : ruta}`);
    }
  });

  test("security.txt, humans.txt y llms.txt se sirven", async ({ request }) => {
    const seguridad = await request.get("/.well-known/security.txt");
    expect(seguridad.status()).toBe(200);
    const textoSeguridad = await seguridad.text();
    expect(textoSeguridad).toContain("Contact: mailto:info@galexbh.dev");
    expect(textoSeguridad).toMatch(/Expires: \d{4}-\d{2}-\d{2}T/);
    expect(textoSeguridad).toContain("Preferred-Languages: es, en");
    expect(textoSeguridad).toContain(`Canonical: ${SITIO}/.well-known/security.txt`);

    for (const ruta of ["/humans.txt", "/llms.txt", "/llms-full.txt"]) {
      const r = await request.get(ruta);
      expect(r.status(), ruta).toBe(200);
    }
    const llms = await (await request.get("/llms.txt")).text();
    expect(llms.startsWith("# Atento")).toBe(true);
    expect(llms).toMatch(/NO diagnóstico/i);
  });
});
