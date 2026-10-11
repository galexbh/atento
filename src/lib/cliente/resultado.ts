/**
 * Página de resultado (/resultado): lee `atento:resultado` y muestra nivel, textos, alertas,
 * gráfico SVG por subescala, acciones (imprimir/PDF, invitar al docente) y código de vínculo.
 */
import type { Escala, EscalaAlerta } from "@/lib/puntuacion/tipos";
import { almacen, formatearCodigo, type ResultadoGuardado } from "./almacen";

const NOMBRE_ESCALA: Record<Escala, string> = {
  inatencion: "Inatención",
  hiperactividad: "Hiperactividad e impulsividad",
  desempeno: "Desempeño (escuela y relaciones)",
  oposicion: "Oposición",
  conducta: "Conducta",
  ansiedad_depresion: "Ansiedad o tristeza",
};

const ETIQUETA_ALERTA: Record<EscalaAlerta, string> = {
  conducta: "Problemas de conducta",
  ansiedad_depresion: "Tristeza, miedo o preocupación",
  oposicion: "Oposición",
};

const INFORMANTE: Record<ResultadoGuardado["informante"], string> = {
  madre: "Madre",
  padre: "Padre",
  cuidador: "Otro cuidador",
  docente: "Docente",
};

const SITIO = "https://atento.galexbh.dev";

function escapar(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

/**
 * Gráfico de barras horizontales (una serie: preguntas marcadas como frecuentes) con marca de
 * umbral. Sigue la guía dataviz: un solo tono, marcas finas, etiquetas directas en texto,
 * umbral como línea, identidad nunca solo por color (texto "alcanza el mínimo").
 */
function construirGrafico(r: ResultadoGuardado, escalas: Escala[]): { svg: string; alt: string } {
  const ancho = 640;
  const altoFila = 58;
  const margen = { izq: 16, der: 72, sup: 12, inf: 20 };
  const anchoBarra = ancho - margen.izq - margen.der;
  const alto = margen.sup + escalas.length * altoFila + margen.inf;
  const filas: string[] = [];
  const alt: string[] = [];

  escalas.forEach((escala, i) => {
    const e = r.escalas.find((x) => x.escala === escala);
    if (!e) return;
    const y = margen.sup + i * altoFila;
    const yBarra = y + 26;
    const w = e.total ? (e.positivosCriterio / e.total) * anchoBarra : 0;
    const xUmbral = e.total ? margen.izq + (e.umbral / e.total) * anchoBarra : margen.izq;
    const nombre = NOMBRE_ESCALA[escala];
    const estado = e.positivo ? " · alcanza el mínimo" : "";
    const incompleto = e.respondidos < e.total ? ` (${e.total - e.respondidos} sin responder)` : "";
    alt.push(
      `${nombre}: ${e.positivosCriterio} de ${e.total} marcadas, mínimo ${e.umbral}${estado}${incompleto}.`,
    );
    filas.push(`
      <g role="listitem">
        <title>${escapar(nombre)}: ${e.positivosCriterio} de ${e.total} marcadas; mínimo relevante ${e.umbral}${escapar(estado)}</title>
        <text x="${margen.izq}" y="${y + 14}" font-size="15" font-weight="700" fill="var(--color-texto)">${escapar(nombre)}${e.positivo ? ' <tspan font-weight="600" fill="var(--color-texto-suave)">· alcanza el mínimo</tspan>' : ""}</text>
        <rect x="${margen.izq}" y="${yBarra}" width="${anchoBarra}" height="14" rx="4" fill="var(--color-primario-suave)"></rect>
        <rect x="${margen.izq}" y="${yBarra}" width="${Math.max(0, w).toFixed(1)}" height="14" rx="4" fill="var(--color-primario)"></rect>
        <line x1="${xUmbral.toFixed(1)}" x2="${xUmbral.toFixed(1)}" y1="${yBarra - 5}" y2="${yBarra + 19}" stroke="var(--color-texto)" stroke-width="2.5" stroke-linecap="round"></line>
        <text x="${ancho - margen.der + 10}" y="${yBarra + 12}" font-size="15" font-weight="700" fill="var(--color-texto)" style="font-variant-numeric: tabular-nums">${e.positivosCriterio} de ${e.total}</text>
      </g>`);
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" role="list" aria-label="Preguntas marcadas como frecuentes por área, con el mínimo relevante de cada una" style="print-color-adjust: exact; -webkit-print-color-adjust: exact">${filas.join("")}</svg>`;
  return { svg, alt: alt.join(" ") };
}

export function iniciarResultado(raiz: HTMLElement): void {
  const r = almacen.leerResultado();
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const sin = $<HTMLElement>("sin-resultado");
  const con = $<HTMLElement>("con-resultado");

  if (!r) {
    sin.hidden = false;
    return;
  }
  con.hidden = false;

  // Metadatos de portada
  const fecha = new Date(r.fecha);
  $("meta-fecha").textContent = fecha.toLocaleDateString("es-HN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  $("meta-codigo").textContent = formatearCodigo(r.codigoVinculo);
  $("meta-informante").textContent =
    `${INFORMANTE[r.informante]} · niño o niña de ${r.edadAnios} años`;

  // Estado de guardado
  const estado = $<HTMLElement>("estado-guardado");
  if (r.investigacion) {
    estado.hidden = false;
    estado.textContent = r.guardado
      ? "Gracias: tu respuesta anónima se sumó al mapa nacional."
      : "No se pudo guardar tu respuesta en el mapa nacional, pero aquí está tu resultado. Puedes intentarlo otro día.";
  }

  // Nivel
  const seccionNivel = raiz.querySelector<HTMLElement>(`[data-nivel="${r.nivel}"]`);
  if (seccionNivel) {
    seccionNivel.hidden = false;
    const nota = seccionNivel.querySelector<HTMLElement>("[data-incompleto]");
    if (nota && r.faltanSintomas !== "ninguna") {
      nota.hidden = false;
      nota.textContent =
        r.faltanSintomas === "total"
          ? "No pudimos calcular un resultado completo porque faltan muchas respuestas. Vuelva al cuestionario y complete las preguntas marcadas. Si prefiere no hacerlo, puede consultar directamente con un profesional."
          : "Algunas preguntas quedaron sin responder. El resultado puede ser menos preciso. Si quiere, puede volver y completarlas.";
    }
  }

  // Gráfico: núcleo siempre; alertas solo si hay alerta en esa escala.
  const escalasGrafico: Escala[] = ["inatencion", "hiperactividad", "desempeno", ...r.alertas];
  const { svg, alt } = construirGrafico(r, escalasGrafico);
  $("grafico-svg").innerHTML = svg;
  $("grafico-alt").textContent = alt;
  const tabla = $<HTMLElement>("grafico-tabla");
  tabla.innerHTML = escalasGrafico
    .map((escala) => {
      const e = r.escalas.find((x) => x.escala === escala);
      if (!e) return "";
      return `<tr><th scope="row">${escapar(NOMBRE_ESCALA[escala])}</th><td>${e.positivosCriterio}${e.positivo ? " (alcanza el mínimo)" : ""}</td><td>${e.umbral}</td><td>${e.respondidos} de ${e.total}</td></tr>`;
    })
    .join("");

  // Alertas: una sola → su bloque; dos o más prioritarias → bloque combinado.
  const prioritarias = r.alertas.filter((a) => a !== "oposicion");
  if (prioritarias.length >= 2 || (prioritarias.length === 1 && r.alertas.length >= 2)) {
    const comb = raiz.querySelector<HTMLElement>('[data-alerta="combinada"]');
    if (comb) {
      comb.hidden = false;
      $("alerta-combinada-lista").innerHTML = r.alertas
        .map((a) => `<li>${escapar(ETIQUETA_ALERTA[a])}</li>`)
        .join("");
    }
  } else {
    for (const a of r.alertas) {
      const bloque = raiz.querySelector<HTMLElement>(`[data-alerta="${a}"]`);
      if (bloque) bloque.hidden = false;
    }
  }

  // Acciones
  $<HTMLButtonElement>("descargar").addEventListener("click", () => window.print());

  const invitar = $<HTMLButtonElement>("invitar");
  const panel = $<HTMLElement>("panel-docente");
  const codigo = formatearCodigo(r.codigoVinculo);
  const mensaje = `Hola. Hice el cuestionario gratuito de Atento sobre señales de atención y conducta en niños. ¿Podría responderlo usted también, como docente? Toma unos 10 minutos y es anónimo: ${SITIO}/cribado/consentimiento — Mi código de vínculo es ${codigo}. ¡Gracias!`;
  $<HTMLTextAreaElement>("mensaje-docente").value = mensaje;
  $("codigo-docente").textContent = codigo;
  $("codigo-grande").textContent = codigo;
  $<HTMLAnchorElement>("whatsapp").href = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

  invitar.addEventListener("click", () => {
    const abierto = panel.hidden;
    panel.hidden = !abierto;
    invitar.setAttribute("aria-expanded", String(abierto));
    if (abierto) {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      $("docente-titulo").setAttribute("tabindex", "-1");
      $("docente-titulo").focus({ preventScroll: true });
    }
  });

  $<HTMLButtonElement>("copiar").addEventListener("click", async () => {
    const aviso = $("copiado");
    try {
      await navigator.clipboard.writeText(mensaje);
      aviso.textContent = "Mensaje copiado.";
    } catch {
      $<HTMLTextAreaElement>("mensaje-docente").select();
      aviso.textContent = "Selecciona el texto y cópialo manualmente.";
    }
  });
}
