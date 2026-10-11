/**
 * Modo claro/oscuro. Preferencia en localStorage `atento:tema` ("claro" | "oscuro");
 * sin valor guardado se sigue al sistema (`prefers-color-scheme`).
 */
const CLAVE = "atento:tema";

function temaActual(): "claro" | "oscuro" {
  const forzado = document.documentElement.dataset.theme;
  if (forzado === "dark") return "oscuro";
  if (forzado === "light") return "claro";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
}

export function alternarTema(): void {
  const nuevo = temaActual() === "oscuro" ? "claro" : "oscuro";
  document.documentElement.dataset.theme = nuevo === "oscuro" ? "dark" : "light";
  try {
    localStorage.setItem(CLAVE, nuevo);
  } catch {
    // Almacenamiento no disponible: el cambio dura solo esta página.
  }
}
