import { defineConfig } from "vitest/config";

// Pruebas unitarias puras (Node): tests/unit/**/*.test.ts
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    passWithNoTests: true,
  },
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
});
