import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("la portada carga y no tiene violaciones serias de accesibilidad", async ({ page }) => {
  const respuesta = await page.goto("/");
  expect(respuesta?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Atento");
  expect(respuesta?.headers()["content-security-policy"]).toContain("script-src 'self' 'nonce-");

  const resultados = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serias = resultados.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(serias, JSON.stringify(serias, null, 2)).toEqual([]);
});
