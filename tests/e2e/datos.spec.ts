import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/**
 * Página pública /datos. Requiere datos sembrados en la D1 local (CI:
 * `pnpm exec wrangler d1 execute atento-db --local --file scripts/seed-admin.sql`).
 * Las capturas van a docs/capturas/datos-publicos-{movil,escritorio}{,-oscuro}.png (datos-*.png ya es el paso
 * "Datos" del cribado).
 */

async function sinViolacionesSerias(page: Page) {
  const resultados = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serias = resultados.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(serias, JSON.stringify(serias, null, 2)).toEqual([]);
}

async function comprobarInforme(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Mapa nacional de cribados");
  await expect(page.getByText("Esto no es la prevalencia de TDAH")).toBeVisible();
  // Mapa con los 18 departamentos enlazados a la tabla y leyenda fija.
  const mapa = page.locator("[data-datos-mapa] svg");
  await expect(mapa).toBeVisible();
  await expect(mapa.locator("a[data-depto]")).toHaveCount(18);
  await expect(page.getByRole("list", { name: "% con indicadores" })).toBeVisible();
  await expect(page.getByText("Menos de 5 respuestas*")).toBeVisible();
  // Tabla por departamento con las 18 filas.
  await expect(page.locator("tr[data-fila-depto]")).toHaveCount(18);
  // Descargas.
  const csv = page.getByRole("link", { name: "CSV" });
  await expect(csv).toHaveAttribute("href", /\/api\/publico\/datos\?anio=\d{4}&formato=csv/);
  await expect(page.getByRole("link", { name: "JSON" })).toBeVisible();
  await expect(page.getByText("Creative Commons Atribución 4.0")).toBeVisible();
}

test.describe("página /datos", () => {
  test("muestra mapa, leyenda, tabla y descargas; claro y oscuro sin violaciones", async ({
    page,
  }, testInfo) => {
    const respuesta = await page.goto("/datos");
    expect(respuesta?.status()).toBe(200);
    await comprobarInforme(page);
    await sinViolacionesSerias(page);
    await page.screenshot({
      path: `docs/capturas/datos-publicos-${testInfo.project.name}.png`,
      fullPage: true,
    });

    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await comprobarInforme(page);
    await sinViolacionesSerias(page);
    await page.screenshot({
      path: `docs/capturas/datos-publicos-${testInfo.project.name}-oscuro.png`,
      fullPage: true,
    });
  });

  test("tocar un departamento muestra su detalle y resalta la fila", async ({ page }) => {
    await page.goto("/datos");
    const enlace = page.locator('[data-datos-mapa] a[data-depto="08"]');
    await enlace.click();
    await expect(page.locator("[data-detalle-tarjeta]")).toContainText("Francisco Morazán");
    await expect(page.locator('tr[data-fila-depto="08"]')).toHaveClass(/es-activa/);
  });

  test("modo número de respuestas por formulario", async ({ page }) => {
    await page.goto("/datos");
    await page.getByText("Número de respuestas", { exact: true }).click();
    await page.getByRole("button", { name: "Actualizar mapa" }).click();
    await expect(page).toHaveURL(/modo=n/);
    await expect(page.getByRole("list", { name: "Respuestas" })).toBeVisible();
    await sinViolacionesSerias(page);
  });

  test("/datos/1999 responde 404", async ({ page }) => {
    const respuesta = await page.goto("/datos/1999");
    expect(respuesta?.status()).toBe(404);
  });
});

test.describe("página /datos sin JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("el informe, los controles y el selector de año funcionan", async ({ page }) => {
    await page.goto("/datos");
    await comprobarInforme(page);

    // Modo por formulario GET.
    await page.getByText("Número de respuestas", { exact: true }).click();
    await page.getByRole("button", { name: "Actualizar mapa" }).click();
    await expect(page).toHaveURL(/\/datos\?modo=n/);
    await expect(page.getByRole("list", { name: "Respuestas" })).toBeVisible();

    // Selector de año: /datos?anio=AAAA redirige a /datos/AAAA.
    const opciones = await page.locator("#selector-anio option").allTextContents();
    const otro = opciones.map((o) => o.trim()).at(-1) as string;
    await page.locator("#selector-anio").selectOption(otro);
    await page.getByRole("button", { name: "Ver año" }).click();
    await expect(page).toHaveURL(new RegExp(`/datos/${otro}`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(otro);

    // Un departamento del mapa es un enlace a su fila de la tabla.
    await expect(page.locator('[data-datos-mapa] a[data-depto="08"]')).toHaveAttribute(
      "href",
      "#depto-08",
    );
  });
});
