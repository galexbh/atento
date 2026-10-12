import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Panel /admin en modo password. Requiere en .dev.vars:
 *   ADMIN_MODO=password
 *   ADMIN_PASSWORD_HASH=<hash de la contraseña de abajo, ver scripts/hash-password.ts>
 * y datos sembrados en la D1 local (pnpm exec wrangler d1 execute atento-db --local --file
 * scripts/seed-admin.sql). Las capturas van a docs/privado/capturas/ (no se publican).
 */
const CONTRASENA = process.env.ADMIN_E2E_PASSWORD ?? "atento-admin-local-2026";

test.describe("panel de administración", () => {
  test("sin sesión redirige a /admin/entrar", async ({ page }) => {
    const respuesta = await page.goto("/admin/geografia");
    expect(page.url()).toContain("/admin/entrar");
    expect(respuesta?.status()).toBe(401);
    await expect(page.getByLabel("Contraseña")).toBeVisible();
  });

  test("la pantalla de entrada no revela el panel ni el mecanismo de acceso", async ({ page }) => {
    await page.goto("/admin/entrar");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Acceso del equipo");
    await expect(page.getByRole("navigation", { name: "Secciones del panel" })).toHaveCount(0);
    const texto = (await page.locator("body").innerText()).toLowerCase();
    for (const palabra of [
      "resumen",
      "psicometría",
      "exportar",
      "password",
      "8 horas",
      "cloudflare",
    ]) {
      expect(texto).not.toContain(palabra);
    }
    const resultados = await new AxeBuilder({ page }).analyze();
    const graves = resultados.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(graves).toEqual([]);
  });

  test("mostrar y ocultar la contraseña", async ({ page }) => {
    await page.goto("/admin/entrar");
    const campo = page.getByLabel("Contraseña");
    await campo.fill("algo-secreto-123");
    await expect(campo).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Mostrar" }).click();
    await expect(campo).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Ocultar" }).click();
    await expect(campo).toHaveAttribute("type", "password");
  });

  test("entra con contraseña y muestra resumen y geografía", async ({ page }, testInfo) => {
    await page.goto("/admin/entrar?volver=/admin");
    await page.getByLabel("Contraseña").fill(CONTRASENA);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Resumen");
    await expect(page.getByText("Respuestas completadas (histórico)")).toBeVisible();

    const esEscritorio = testInfo.project.name === "escritorio";
    if (esEscritorio) {
      await page.screenshot({ path: "docs/privado/capturas/admin-resumen.png", fullPage: true });
    }

    const axeResumen = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serias = axeResumen.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serias, JSON.stringify(serias, null, 2)).toEqual([]);

    await page.goto("/admin/geografia?periodo=acumulado");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Geografía");
    await expect(page.locator("#d-08")).toBeVisible();
    await expect(page.getByRole("table").first()).toBeVisible();
    if (esEscritorio) {
      await page.setViewportSize({ width: 1280, height: 1400 });
      await page.screenshot({ path: "docs/privado/capturas/admin-geografia.png" });
    }
    const axeGeo = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const seriasGeo = axeGeo.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(seriasGeo, JSON.stringify(seriasGeo, null, 2)).toEqual([]);

    // Las demás secciones cargan sin error.
    for (const ruta of [
      "volumen",
      "demografia",
      "puntajes",
      "comorbilidad",
      "desempeno",
      "psicometria",
      "calidad",
      "investigacion",
      "historico",
      "exportar",
      "sistema",
    ]) {
      const r = await page.goto(`/admin/${ruta}?periodo=acumulado`);
      expect(r?.status(), ruta).toBe(200);
    }
  });

  test("contraseña incorrecta muestra error", async ({ page }) => {
    await page.goto("/admin/entrar");
    await page.getByLabel("Contraseña").fill("contrasena-incorrecta-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert")).toContainText("No pudimos iniciar tu sesión");
  });
});
