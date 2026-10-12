import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("elegir quién responde", () => {
  test("los botones Empezar llevan a la página de elección", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("link", { name: /Empezar el cribado/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/empezar$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("¿Quién va a responder?");
  });

  test("familia va al consentimiento y docente a su versión", async ({ page }) => {
    await page.goto("/empezar");
    await page.getByRole("link", { name: /Soy madre, padre o cuidador/ }).click();
    await expect(page).toHaveURL(/\/cribado\/consentimiento$/);
    await page.goto("/empezar");
    await page.getByRole("link", { name: /Soy docente/ }).click();
    await expect(page).toHaveURL(/\/docente$/);
  });

  test("accesible y no indexable", async ({ page }) => {
    await page.goto("/empezar");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual(
      [],
    );
  });
});

test.describe("tema en la pantalla de acceso del panel", () => {
  test("respeta la preferencia guardada y el botón la cambia", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("atento:tema", "oscuro"));
    await page.goto("/admin/entrar");
    const tema = () => page.evaluate(() => document.documentElement.dataset.theme ?? null);
    expect(await tema()).toBe("dark");
    await page.getByRole("button", { name: "Cambiar entre modo claro y oscuro" }).click();
    expect(await tema()).toBe("light");
    expect(await page.evaluate(() => localStorage.getItem("atento:tema"))).toBe("claro");
  });
});
