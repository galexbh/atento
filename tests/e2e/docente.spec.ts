import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/**
 * Versión docente: presentación (/docente?codigo=) → consentimiento → datos → cuestionario →
 * hoja imprimible. `/api/respuesta` se intercepta y Turnstile se sustituye por un stub, como en
 * flujo.spec.ts. Corre en móvil (Pixel 7) y escritorio (proyectos de playwright.config.ts).
 */

async function sinViolacionesSerias(page: Page): Promise<void> {
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

/** Marca en cada ítem visible la opción `indice` (o la última si hay menos). */
async function responderPagina(page: Page, indice: number): Promise<void> {
  const items = page.locator("fieldset.item:visible");
  const n = await items.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const radios = items.nth(i).locator('input[type="radio"]');
    const total = await radios.count();
    await radios.nth(Math.min(indice, total - 1)).check({ force: true });
  }
}

async function recorrerFlujoDocente(
  page: Page,
  opciones: { investigacion: boolean; indice: number; capturas?: string },
) {
  const envios: unknown[] = [];
  await prepararRed(page, envios);

  // 1. Presentación con código en el enlace (minúsculas y guion: se normaliza).
  await page.goto("/docente?codigo=abcd-2345");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Su mirada desde el aula");
  await expect(page.locator("#codigo-recibido")).toContainText("ABCD-2345");
  await expect(page).toHaveURL(/\/docente$/); // el código sale de la barra de direcciones
  await sinViolacionesSerias(page);
  if (opciones.capturas) {
    await page.screenshot({
      path: `docs/capturas/docente-presentacion-${opciones.capturas}.png`,
      fullPage: true,
    });
  }
  await page.locator("#empezar").click();

  // 2. Consentimiento docente.
  await expect(page).toHaveURL(/\/docente\/consentimiento/);
  await esperarListo(page);
  const continuar = page.getByRole("button", { name: "Continuar" });
  await expect(continuar).toBeDisabled();
  await page.getByLabel(/Soy docente del niño o niña/).check();
  await page.getByLabel(/He leído y acepto/).check();
  if (opciones.investigacion) await page.getByLabel(/Opcional\./).check();
  await expect(continuar).toBeEnabled();
  await sinViolacionesSerias(page);
  if (opciones.capturas) {
    await page.screenshot({
      path: `docs/capturas/docente-consentimiento-${opciones.capturas}.png`,
      fullPage: true,
    });
  }
  await continuar.click();

  // 3. Datos: escuela, edad, sexo y código prellenado.
  await expect(page).toHaveURL(/\/docente\/datos/);
  await esperarListo(page);
  await expect(page.locator("#codigo")).toHaveValue("ABCD-2345");
  await page.getByLabel("¿En qué departamento está la escuela?").selectOption("05");
  const muni = page.getByLabel("¿En qué municipio está la escuela?");
  await expect(muni).toBeEnabled();
  await muni.selectOption("0501");
  await page.getByLabel("9", { exact: true }).check({ force: true });
  await page.getByLabel("Niño", { exact: true }).check({ force: true });
  await expect(page.getByLabel("Docente", { exact: true })).toHaveCount(0); // no se pregunta
  await sinViolacionesSerias(page);
  if (opciones.capturas) {
    await page.screenshot({
      path: `docs/capturas/docente-datos-${opciones.capturas}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Continuar" }).click();

  // 4. Cuestionario: 7 páginas (6 de frecuencia y 1 de desempeño).
  await expect(page).toHaveURL(/\/docente\/cuestionario/);
  await esperarListo(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("inicio del año escolar");
  await expect(page.locator("#progreso-texto")).toContainText("Página 1 de 7");
  await sinViolacionesSerias(page);
  if (opciones.capturas) {
    await page.screenshot({
      path: `docs/capturas/docente-cuestionario-${opciones.capturas}.png`,
      fullPage: true,
    });
  }
  const siguiente = page.locator("#siguiente");
  for (let p = 0; p < 7; p++) {
    if (p === 6) await expect(page.locator("fieldset.item:visible")).toHaveCount(8);
    await responderPagina(page, opciones.indice);
    await siguiente.click();
  }
  await expect(page.locator("#envio")).toBeVisible();
  await page.getByRole("button", { name: "Ver la hoja para imprimir" }).click();

  // 5. Agradecimiento y hoja.
  await expect(page).toHaveURL(/\/docente\/gracias/);
  await expect(page.locator("#con-hoja")).toBeVisible();
  await expect(page.locator(".hoja")).toContainText(
    "Para entregar a la familia o al profesional de salud. No es un diagnóstico ni un resultado.",
  );
  await sinViolacionesSerias(page);
  return envios;
}

test("flujo docente completo con investigación y código del enlace", async ({ page }, info) => {
  const envios = await recorrerFlujoDocente(page, {
    investigacion: true,
    indice: 3,
    capturas: info.project.name,
  });
  expect(envios).toHaveLength(1);
  const envio = envios[0] as Record<string, unknown>;
  expect(envio.instrumentoId).toBe("vanderbilt-docente-es-1.0");
  expect(envio.informante).toBe("docente");
  expect(envio.codigoVinculo).toBe("ABCD2345");
  expect(envio.versionConsentimiento).toBe("2026-10-12");
  expect(envio.departamento).toBe("05");
  expect(envio.municipio).toBe("0501");
  expect(envio.respuestasAtento).toBeUndefined();
  expect(Object.keys(envio.respuestas as object)).toHaveLength(43);
  expect(envio.turnstileToken).toBe("token-de-prueba");

  // La hoja muestra conteos y desempeño, nunca nivel ni interpretación.
  const hoja = page.locator(".hoja");
  await expect(page.locator("#hoja-escalas tr")).toHaveCount(4);
  await expect(page.locator("#hoja-escalas")).toContainText("9 de 9");
  await expect(page.locator("#hoja-codigo")).toHaveText("ABCD-2345");
  await expect(page.locator("#hoja-desempeno li")).toHaveCount(8);
  const textoHoja = (await hoja.innerText()).toLowerCase();
  for (const prohibido of ["nivel", "alto", "moderado", "positivo", "mínimo relevante"]) {
    expect(textoHoja, prohibido).not.toContain(prohibido);
  }
  await expect(page.locator("[data-nivel]")).toHaveCount(0);
  await expect(page.locator("#estado-guardado")).toContainText("se guardó para investigación");
  await page.screenshot({
    path: `docs/capturas/docente-gracias-${info.project.name}.png`,
    fullPage: true,
  });

  // Impresión: solo la hoja (acciones y cabecera de agradecimiento ocultas).
  await page.emulateMedia({ media: "print" });
  await expect(hoja).toBeVisible();
  await expect(page.locator(".acciones")).toBeHidden();
  await expect(page.locator(".gracias__cabecera")).toBeHidden();
  await page.emulateMedia({ media: "screen" });

  // El código no pasa al siguiente niño; el progreso se borró; la hoja no tiene ítems.
  const claves = await page.evaluate(() => ({
    codigo: localStorage.getItem("atento:docente:codigo"),
    progreso: localStorage.getItem("atento:docente:progreso"),
    hoja: localStorage.getItem("atento:docente:hoja"),
    familia: localStorage.getItem("atento:resultado"),
  }));
  expect(claves.codigo).toBeNull();
  expect(claves.progreso).toBeNull();
  expect(claves.hoja).not.toContain('"T01"');
  expect(claves.familia).toBeNull();
});

test("flujo docente sin investigación: no envía nada y genera la hoja local", async ({ page }) => {
  const envios = await recorrerFlujoDocente(page, { investigacion: false, indice: 0 });
  expect(envios).toHaveLength(0);
  await expect(page.locator("#estado-guardado")).toBeHidden();
  await expect(page.locator("#hoja-escalas")).toContainText("0 de 9");
  await expect(page.locator("#hoja-desempeno")).toContainText("Ninguna área");
});

test("código de vínculo inválido en datos: avisa y no continúa", async ({ page }) => {
  await prepararRed(page, []);
  await page.goto("/docente/consentimiento");
  await esperarListo(page);
  await page.getByLabel(/Soy docente del niño o niña/).check();
  await page.getByLabel(/He leído y acepto/).check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await esperarListo(page);
  await page.getByLabel("¿En qué departamento está la escuela?").selectOption("08");
  await page.getByLabel("¿En qué municipio está la escuela?").selectOption("0801");
  await page.getByLabel("7", { exact: true }).check({ force: true });
  await page.getByLabel("Niña", { exact: true }).check({ force: true });
  await page.locator("#codigo").fill("abc-12");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.locator("#ayuda-datos")).toContainText("8 letras o números");
  await expect(page).toHaveURL(/\/docente\/datos/);
  // Vacío también vale (sin código).
  await page.locator("#codigo").fill("");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/docente\/cuestionario/);
});

test.describe("sin JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("la presentación /docente se lee entera y enlaza al consentimiento", async ({ page }) => {
    await page.goto("/docente?codigo=ABCD2345");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Su mirada desde el aula");
    await expect(page.getByText("más de un entorno")).toBeVisible();
    await expect(page.locator("#empezar")).toHaveAttribute("href", "/docente/consentimiento");
    await expect(page.locator("#codigo-recibido")).toBeHidden();
  });
});
