/**
 * Carga en tiempo de build los SVG de `public/` para incrustarlos inline.
 *
 * Inline es necesario para que las ilustraciones hereden los tokens de color (`var(--c-*)`)
 * y los iconos usen `currentColor`; un `<img>` externo no recibe variables CSS de la página.
 * Los SVG fuente llevan `id="t"` para su <title>: se renombra por instancia para evitar ids
 * duplicados cuando hay varios en la misma página.
 */

const ILUSTRACIONES = import.meta.glob("/public/ilustraciones/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const ICONOS = import.meta.glob("/public/ilustraciones/iconos/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const MARCA = import.meta.glob("/public/marca/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

let contador = 0;

function unico(prefijo: string): string {
  contador = (contador + 1) % 1_000_000;
  return `${prefijo}-${contador.toString(36)}`;
}

export interface OpcionesSvg {
  /** Clase CSS para el elemento <svg>. */
  clase?: string;
  /** Texto alternativo; si se omite se conserva el <title> del archivo. */
  titulo?: string;
  /** Si es decorativo: aria-hidden y sin <title>. */
  decorativo?: boolean;
  /** Atributos extra (width, height, ...). */
  atributos?: Record<string, string>;
}

function prepararSvg(fuente: string, opciones: OpcionesSvg): string {
  let svg = fuente.trim();
  const id = unico("svg");
  // Renombra ids de <title> internos (id="t", id="hn-titulo") y sus referencias.
  const ref = /aria-labelledby="([^"]+)"/.exec(svg)?.[1];
  if (ref) {
    svg = svg
      .replace(`id="${ref}"`, `id="${id}"`)
      .replace(`aria-labelledby="${ref}"`, `aria-labelledby="${id}"`);
  }
  if (opciones.decorativo) {
    svg = svg.replace(/aria-labelledby="[^"]+"/, 'aria-hidden="true"');
    svg = svg.replace(/<title id="[^"]+">[^<]*<\/title>/, "");
    svg = svg.replace(/ role="img"/, "");
  } else if (opciones.titulo) {
    svg = svg.replace(
      /<title id="([^"]+)">[^<]*<\/title>/,
      `<title id="$1">${opciones.titulo}</title>`,
    );
  }
  const extra: string[] = [];
  if (opciones.clase) extra.push(`class="${opciones.clase}"`);
  for (const [k, v] of Object.entries(opciones.atributos ?? {})) extra.push(`${k}="${v}"`);
  if (extra.length) svg = svg.replace("<svg ", `<svg ${extra.join(" ")} `);
  return svg;
}

function buscar(mapa: Record<string, string>, nombre: string, carpeta: string): string {
  const clave = Object.keys(mapa).find((k) => k.endsWith(`/${nombre}.svg`));
  if (!clave) {
    throw new Error(`SVG "${nombre}" no encontrado en ${carpeta}`);
  }
  return mapa[clave] as string;
}

export function ilustracion(nombre: string, opciones: OpcionesSvg = {}): string {
  return prepararSvg(buscar(ILUSTRACIONES, nombre, "public/ilustraciones"), opciones);
}

export function icono(nombre: string, opciones: OpcionesSvg = {}): string {
  return prepararSvg(buscar(ICONOS, nombre, "public/ilustraciones/iconos"), {
    decorativo: true,
    ...opciones,
  });
}

export function marca(nombre: string, opciones: OpcionesSvg = {}): string {
  return prepararSvg(buscar(MARCA, nombre, "public/marca"), opciones);
}
