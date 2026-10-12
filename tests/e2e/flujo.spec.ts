import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/**
 * Flujo público completo: consentimiento → datos → cuestionario → resultado.
 * `/api/respuesta` se intercepta (puede no existir aún) y Turnstile se sustituye por un stub.
 */

async function sinViolacionesSerias(page: Page): Promise<void> {
  // Sin animaciones de entrada: axe mide colores a mitad de transición y falla por contraste.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const resultados = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serias = resultados.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(serias, JSON.stringify(serias, null, 2)).toEqual([]);
}

async function prepararRed(page: Page, envios: unknown[]): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/respuesta", async (route) => {
    envios.push(route.request().postDataJSON());
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  // Stub de Turnstile: define window.turnstile y dispara el onload con un token de prueba.
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", async (route) => {
    const url = new URL(route.request().url());
    const onload = url.searchParams.get("onload") ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `window.turnstile={render:function(el,o){el.textContent="turnstile-stub";setTimeout(function(){o.callback("token-de-prueba")},0);return "w1"},reset:function(){},getResponse:function(){return "token-de-prueba"}};if(window["${onload}"])window["${onload}"]();`,
    });
  });
}

async function esperarListo(page: Page): Promise<void> {
  await expect(page.locator("form[data-listo]")).toHaveCount(1);
}

async function responderPagina(page: Page, valor: number): Promise<void> {
  const items = page.locator("fieldset.item:visible");
  const n = await items.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const item = items.nth(i);
    const radios = item.locator('input[type="radio"]');
    const total = await radios.count();
    const indice = Math.min(valor, total - 1);
    await radios.nth(indice).check({ force: true });
  }
}

async function recorrerFlujo(page: Page, opciones: { investigacion: boolean; valor: number }) {
  const envios: unknown[] = [];
  await prepararRed(page, envios);

  // 1. Consentimiento
  await page.goto("/cribado/consentimiento");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Antes de empezar");
  await esperarListo(page);
  const continuar = page.getByRole("button", { name: "Empezar el cuestionario" });
  await expect(continuar).toBeDisabled();
  await page.getByLabel(/Confirmo que soy mayor de 18/).check();
  await page.getByLabel(/He leído y acepto/).check();
  if (opciones.investigacion) await page.getByLabel(/Opcional\./).check();
  await expect(continuar).toBeEnabled();
  await sinViolacionesSerias(page);
  await continuar.click();

  // 2. Datos
  await expect(page).toHaveURL(/\/cribado\/datos/);
  await esperarListo(page);
  await page.getByLabel("¿En qué departamento viven?").selectOption("08");
  const muni = page.getByLabel("¿En qué municipio?");
  await expect(muni).toBeEnabled();
  await muni.selectOption("0801");
  await page.getByLabel("8", { exact: true }).check({ force: true });
  await page.getByLabel("Niña", { exact: true }).check({ force: true });
  await page.getByLabel("Madre", { exact: true }).check({ force: true });
  await sinViolacionesSerias(page);
  await page.getByRole("button", { name: "Continuar" }).click();

  // 3. Cuestionario (12 páginas de 6)
  await expect(page).toHaveURL(/\/cribado\/cuestionario/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("últimos 6 meses");
  await esperarListo(page);
  await sinViolacionesSerias(page);
  const siguiente = page.locator("#siguiente");
  for (let p = 0; p < 12; p++) {
    await responderPagina(page, opciones.valor);
    await siguiente.click();
  }
  await expect(page.locator("#envio")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Listo/ })).toBeVisible();
  await page.getByRole("button", { name: "Ver mi resultado" }).click();

  // 4. Resultado
  await expect(page).toHaveURL(/\/resultado/);
  await expect(page.locator("#con-resultado")).toBeVisible();
  await expect(page.locator("#grafico-svg svg")).toBeVisible();
  await expect(page.locator("#codigo-grande")).toHaveText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await sinViolacionesSerias(page);
  return envios;
}

test("flujo completo con investigación: envía a la API y muestra nivel alto", async ({ page }) => {
  const envios = await recorrerFlujo(page, { investigacion: true, valor: 3 });
  expect(envios).toHaveLength(1);
  const envio = envios[0] as Record<string, unknown>;
  expect(envio.instrumentoId).toBe("vanderbilt-padres-es-1.0");
  expect(Object.keys(envio.respuestas as object)).toHaveLength(54);
  expect(Object.keys(envio.respuestasAtento as object)).toHaveLength(18);
  expect(envio.departamento).toBe("08");
  expect(envio.municipio).toBe("0801");
  expect(envio.consentimientoInvestigacion).toBe(true);
  expect(envio.versionConsentimiento).toBe("2026-10-11");
  expect(envio.hp).toBe("");
  expect(envio.turnstileToken).toBe("token-de-prueba");
  await expect(page.locator('[data-nivel="alto"]')).toBeVisible();
  await expect(page.locator("#estado-guardado")).toContainText("se sumó al mapa");
  // Con todo en 3, también hay alertas de comorbilidad (bloque combinado).
  await expect(page.locator('[data-alerta="combinada"]')).toBeVisible();

  // Invitar al docente: enlace a /docente?codigo= con el código y nunca el resultado.
  await page.getByRole("button", { name: "Invitar al docente" }).click();
  const mensaje = await page.locator("#mensaje-docente").inputValue();
  const codigo = ((await page.locator("#codigo-grande").textContent()) ?? "").replace("-", "");
  expect(mensaje).toMatch(/\/docente\?codigo=[A-Z2-9]{8}/);
  expect(mensaje).toContain(`/docente?codigo=${codigo}`);
  expect(mensaje).not.toContain("/cribado/");
  expect(mensaje).not.toMatch(/alto|moderado|bajo|nivel|indicadores/i);
  const whatsapp = await page.locator("#whatsapp").getAttribute("href");
  expect(decodeURIComponent(whatsapp ?? "")).toContain(`/docente?codigo=${codigo}`);

  // El progreso se borró y el resultado quedó sin ítems.
  const claves = await page.evaluate(() => ({
    progreso: localStorage.getItem("atento:progreso"),
    resultado: localStorage.getItem("atento:resultado"),
  }));
  expect(claves.progreso).toBeNull();
  expect(claves.resultado).not.toContain('"V01"');
});

test("flujo sin investigación: no envía nada y muestra nivel bajo", async ({ page }) => {
  const envios = await recorrerFlujo(page, { investigacion: false, valor: 0 });
  expect(envios).toHaveLength(0);
  await expect(page.locator('[data-nivel="bajo"]')).toBeVisible();
  await expect(page.locator("#estado-guardado")).toBeHidden();
});

test("edad fuera de rango muestra el aviso y no continúa", async ({ page }) => {
  await page.goto("/cribado/consentimiento");
  await esperarListo(page);
  await page.getByLabel(/Confirmo que soy mayor de 18/).check();
  await page.getByLabel(/He leído y acepto/).check();
  await page.getByRole("button", { name: "Empezar el cuestionario" }).click();
  await esperarListo(page);
  await page.getByLabel("¿En qué departamento viven?").selectOption("01");
  await page.getByLabel("¿En qué municipio?").selectOption("0101");
  await page.getByLabel("Menos de 6", { exact: true }).check({ force: true });
  await page.getByLabel("Niño", { exact: true }).check({ force: true });
  await page.getByLabel("Padre", { exact: true }).check({ force: true });
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.locator("#fuera-rango")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /6 a 12 años/ })).toBeVisible();
  await expect(page).toHaveURL(/\/cribado\/datos/);
  await sinViolacionesSerias(page);
});

test("el progreso del cuestionario se restaura al recargar", async ({ page }) => {
  await prepararRed(page, []);
  await page.goto("/cribado/consentimiento");
  await esperarListo(page);
  await page.getByLabel(/Confirmo que soy mayor de 18/).check();
  await page.getByLabel(/He leído y acepto/).check();
  await page.getByRole("button", { name: "Empezar el cuestionario" }).click();
  await esperarListo(page);
  await page.getByLabel("¿En qué departamento viven?").selectOption("05");
  await page.getByLabel("¿En qué municipio?").selectOption("0501");
  await page.getByLabel("10", { exact: true }).check({ force: true });
  await page.getByLabel("Niña", { exact: true }).check({ force: true });
  await page.getByLabel("Otro cuidador", { exact: true }).check({ force: true });
  await page.getByRole("button", { name: "Continuar" }).click();
  await esperarListo(page);
  await responderPagina(page, 1);
  await page.locator("#siguiente").click();
  await expect(page.locator("#progreso-texto")).toContainText("Página 2 de 12");
  await page.reload();
  await esperarListo(page);
  await expect(page.locator("#progreso-texto")).toContainText("Página 2 de 12 · 6 de 72");
  await expect(page.locator('fieldset.item[data-pagina="1"]:visible')).toHaveCount(6);
});

test("/cribado/datos ya no ofrece 'docente' y enlaza a la versión para docentes", async ({
  page,
}) => {
  await page.goto("/cribado/consentimiento");
  await esperarListo(page);
  await page.getByLabel(/Confirmo que soy mayor de 18/).check();
  await page.getByLabel(/He leído y acepto/).check();
  await page.getByRole("button", { name: "Empezar el cuestionario" }).click();
  await esperarListo(page);
  await expect(page.locator('input[name="informante"]')).toHaveCount(3);
  await expect(page.locator('input[name="informante"][value="docente"]')).toHaveCount(0);
  await expect(page.getByLabel("Docente", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "versión para docentes" })).toHaveAttribute(
    "href",
    "/docente",
  );
});

test("páginas públicas sin violaciones serias de accesibilidad", async ({ page }) => {
  const rutas = [
    "/",
    "/metodologia",
    "/docente",
    "/contacto",
    "/legal/terminos",
    "/legal/privacidad",
    "/legal/aviso-de-salud",
    "/legal/cookies",
    "/legal/accesibilidad",
    "/legal/creditos",
    "/legal/datos-abiertos",
    "/resultado",
    "/pagina-que-no-existe",
  ];
  for (const ruta of rutas) {
    await page.goto(ruta);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await sinViolacionesSerias(page);
  }
});
