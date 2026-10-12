import { defineConfig, devices } from "@playwright/test";

const PUERTO = 4321;
/** Con E2E_URL las pruebas corren contra una build ya servida (p. ej. `pnpm preview`). */
const URL_BUILD = process.env.E2E_URL;
const URL_BASE = URL_BUILD ?? `http://localhost:${PUERTO}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: URL_BASE,
    trace: "on-first-retry",
    locale: "es-HN",
  },
  projects: [
    { name: "movil", use: { ...devices["Pixel 7"] } },
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: URL_BUILD
    ? undefined
    : {
        command: `pnpm dev --port ${PUERTO}`,
        url: URL_BASE,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
