import { ACCION_ENVIO } from "@/lib/compartido/turnstile";
/**
 * Motor común de los cuestionarios del navegador (familia en /cribado/cuestionario y docente en
 * /docente/cuestionario). Lo que comparten ambos:
 *
 * - Los ítems ya vienen en el HTML (fieldsets con `data-pagina`, ver `components/Cuestionario.astro`);
 *   aquí se muestran por páginas, se guarda el progreso (con el almacén que pase cada flujo) y se
 *   restaura al recargar.
 * - Cronómetro: cuenta segundos mientras la pestaña está visible (duracionSegundos).
 * - Pantalla final con Turnstile (misma acción `envio-respuesta` y misma clave de sitio) y honeypot;
 *   Turnstile solo se carga si la persona autorizó el uso para investigación.
 * - Envío: cada flujo decide qué calcular, qué guardar y qué mandar (`alEnviar`); el motor
 *   gestiona el botón, el token y la navegación final.
 */
import type { Progreso } from "./almacen";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opciones: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      getResponse: (id?: string) => string | undefined;
    };
    atentoTurnstileListo?: () => void;
  }
}

const CLAVE_PRUEBAS_TURNSTILE = "1x00000000000000000000AA";

export interface AlmacenProgreso {
  leer: () => Progreso | null;
  guardar: (p: Progreso) => unknown;
  borrar: () => void;
}

export interface ContextoEnvio {
  /** itemId → valor de todo lo respondido (de todos los instrumentos de la página). */
  respuestas: Record<string, number>;
  /** Fieldsets de los ítems (con `data-id` y `data-instrumento`). */
  items: HTMLFieldSetElement[];
  segundos: number;
  hp: string;
  /** Token de Turnstile o "" si no hay. */
  turnstileToken: string;
  /** Pide un token nuevo (los tokens son de un solo uso: tras un envío fallido). */
  reiniciarTurnstile: () => void;
  /** Texto de estado bajo el botón (región aria-live). */
  estado: (texto: string) => void;
}

export interface OpcionesMotor {
  progreso: AlmacenProgreso;
  /** Destino del botón "Cambiar datos" en la primera página. */
  rutaDatos: string;
  /** Si la persona autorizó investigación: carga Turnstile y exige el token antes de enviar. */
  conInvestigacion: boolean;
  /** Textos de la pantalla final. */
  textosEnvio: { texto: string; nota: string };
  /** Mensaje si Turnstile no carga. */
  textoErrorTurnstile: string;
  /**
   * Calcula, guarda y (si corresponde) envía. Devuelve la URL a la que navegar al terminar.
   * El motor ya comprobó el token de Turnstile y deshabilitó el botón.
   */
  alEnviar: (contexto: ContextoEnvio) => Promise<string>;
}

/** POST a /api/respuesta. Verdadero solo si el servidor respondió 2xx. */
export async function enviarRespuesta(cuerpo: Record<string, unknown>): Promise<boolean> {
  try {
    const r = await fetch("/api/respuesta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export function iniciarMotorCuestionario(raiz: HTMLElement, opciones: OpcionesMotor): void {
  const totalPaginas = Number(raiz.dataset.paginas);
  const totalItems = Number(raiz.dataset.items);
  const instrumentoId = raiz.dataset.instrumento ?? "";
  const claveTurnstile = raiz.dataset.turnstile || CLAVE_PRUEBAS_TURNSTILE;

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const form = $<HTMLFormElement>("formulario");
  const intro = $<HTMLElement>("intro");
  const items = Array.from(form.querySelectorAll<HTMLFieldSetElement>("fieldset.item"));
  const ayuda = $<HTMLElement>("ayuda");
  const acciones = $<HTMLElement>("acciones");
  const botonAtras = $<HTMLButtonElement>("atras");
  const botonSiguiente = $<HTMLButtonElement>("siguiente");
  const envio = $<HTMLElement>("envio");
  const envioTitulo = $<HTMLElement>("envio-titulo");
  const envioTexto = $<HTMLElement>("envio-texto");
  const envioNota = $<HTMLElement>("envio-nota");
  const envioEstado = $<HTMLElement>("envio-estado");
  const botonEnviar = $<HTMLButtonElement>("enviar");
  const botonEnvioAtras = $<HTMLButtonElement>("envio-atras");
  const barra = $<HTMLElement>("progreso-barra");
  const relleno = $<HTMLElement>("progreso-relleno");
  const progresoTexto = $<HTMLElement>("progreso-texto");
  const contenedorTurnstile = $<HTMLElement>("turnstile-widget");

  // ---- Estado ----
  const previo = opciones.progreso.leer();
  const respuestas: Record<string, number> =
    previo?.instrumentoId === instrumentoId ? { ...previo.respuestas } : {};
  let pagina =
    previo?.instrumentoId === instrumentoId ? Math.min(previo.pagina, totalPaginas - 1) : 0;
  let segundos = previo?.segundos ?? 0;
  let ultimoTick = Date.now();
  let turnstileToken = "";
  let terminado = false;
  let turnstileId: string | undefined;

  // ---- Cronómetro (solo con pestaña visible) ----
  function tick(): void {
    const ahora = Date.now();
    if (document.visibilityState === "visible") {
      segundos += Math.min(60, Math.round((ahora - ultimoTick) / 1000));
    }
    ultimoTick = ahora;
  }
  const temporizador = window.setInterval(() => {
    tick();
    guardarProgreso();
  }, 15_000);
  document.addEventListener("visibilitychange", () => {
    tick();
    guardarProgreso();
  });

  function guardarProgreso(): void {
    if (terminado) return;
    opciones.progreso.guardar({
      instrumentoId,
      respuestas,
      pagina,
      segundos,
      actualizado: new Date().toISOString(),
    });
  }

  // ---- Restaurar respuestas en el DOM ----
  for (const [id, valor] of Object.entries(respuestas)) {
    const radio = form.querySelector<HTMLInputElement>(
      `input[name="item-${id}"][value="${valor}"]`,
    );
    if (radio) radio.checked = true;
  }

  form.addEventListener("change", (ev) => {
    const objetivo = ev.target as HTMLInputElement;
    if (objetivo.type !== "radio" || !objetivo.name.startsWith("item-")) return;
    const id = objetivo.name.slice(5);
    respuestas[id] = Number(objetivo.value);
    objetivo.closest(".item")?.classList.remove("item--falta");
    ayuda.textContent = "";
    actualizarProgreso();
    guardarProgreso();
  });

  // ---- Navegación ----
  function respondidos(): number {
    return Object.keys(respuestas).length;
  }

  function actualizarProgreso(): void {
    const n = respondidos();
    const pct = Math.round((n / totalItems) * 100);
    relleno.style.transform = `scaleX(${(pct / 100).toFixed(3)})`;
    barra.setAttribute("aria-valuenow", String(n));
    progresoTexto.textContent = `Página ${Math.min(pagina + 1, totalPaginas)} de ${totalPaginas} · ${n} de ${totalItems} respondidas`;
  }

  function mostrarPagina(nueva: number, enfocar = true): void {
    pagina = Math.max(0, Math.min(nueva, totalPaginas - 1));
    for (const el of items) {
      el.hidden = Number(el.dataset.pagina) !== pagina;
    }
    intro.hidden = pagina !== 0;
    envio.hidden = true;
    acciones.hidden = false;
    botonAtras.textContent = pagina === 0 ? "Cambiar datos" : "Atrás";
    botonSiguiente.textContent = pagina === totalPaginas - 1 ? "Terminar" : "Siguiente";
    actualizarProgreso();
    guardarProgreso();
    window.scrollTo({ top: 0, behavior: "auto" });
    if (enfocar) {
      const primero = items.find((el) => !el.hidden);
      primero?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    }
  }

  function faltantesEnPagina(): HTMLFieldSetElement[] {
    return items.filter(
      (el) => Number(el.dataset.pagina) === pagina && !((el.dataset.id as string) in respuestas),
    );
  }

  botonAtras.addEventListener("click", () => {
    if (pagina === 0) {
      window.location.href = opciones.rutaDatos;
      return;
    }
    mostrarPagina(pagina - 1);
  });

  botonSiguiente.addEventListener("click", () => {
    const faltan = faltantesEnPagina();
    for (const el of items) el.classList.remove("item--falta");
    if (faltan.length) {
      for (const el of faltan) el.classList.add("item--falta");
      ayuda.textContent =
        faltan.length === 1
          ? "Falta responder 1 pregunta de esta página."
          : `Faltan responder ${faltan.length} preguntas de esta página.`;
      faltan[0]?.querySelector<HTMLInputElement>("input")?.focus();
      return;
    }
    ayuda.textContent = "";
    if (pagina === totalPaginas - 1) {
      mostrarEnvio();
      return;
    }
    mostrarPagina(pagina + 1);
  });

  botonEnvioAtras.addEventListener("click", () => mostrarPagina(totalPaginas - 1));

  // ---- Pantalla de envío ----
  function mostrarEnvio(): void {
    for (const el of items) el.hidden = true;
    intro.hidden = true;
    acciones.hidden = true;
    envio.hidden = false;
    tick();
    guardarProgreso();
    envioTexto.textContent = opciones.textosEnvio.texto;
    envioNota.textContent = opciones.textosEnvio.nota;
    if (opciones.conInvestigacion) cargarTurnstile();
    window.scrollTo({ top: 0 });
    envioTitulo.focus();
  }

  function cargarTurnstile(): void {
    if (typeof window.turnstile?.render === "function") {
      renderizarTurnstile();
      return;
    }
    window.atentoTurnstileListo = renderizarTurnstile;
    const nonce = document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content ?? "";
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=atentoTurnstileListo";
    script.async = true;
    script.defer = true;
    script.nonce = nonce;
    script.addEventListener("error", () => {
      envioEstado.textContent = opciones.textoErrorTurnstile;
    });
    document.head.appendChild(script);
  }

  function renderizarTurnstile(): void {
    if (typeof window.turnstile?.render !== "function" || turnstileId !== undefined) return;
    turnstileId = window.turnstile.render(contenedorTurnstile, {
      sitekey: claveTurnstile,
      action: ACCION_ENVIO,
      language: "es",
      theme: "auto",
      callback: (token: string) => {
        turnstileToken = token;
        envioEstado.textContent = "";
      },
      "expired-callback": () => {
        turnstileToken = "";
      },
      "error-callback": () => {
        turnstileToken = "";
      },
    });
  }

  // ---- Envío ----
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (botonEnviar.disabled) return;
    tick();
    if (
      opciones.conInvestigacion &&
      !turnstileToken &&
      typeof window.turnstile?.render === "function"
    ) {
      envioEstado.textContent = "Completa la verificación antibots para continuar.";
      return;
    }
    const hp = (form.elements.namedItem("hp") as HTMLInputElement | null)?.value ?? "";
    botonEnviar.disabled = true;
    const destino = await opciones.alEnviar({
      respuestas: { ...respuestas },
      items,
      segundos,
      hp,
      turnstileToken,
      reiniciarTurnstile: () => {
        if (turnstileId !== undefined) {
          window.turnstile?.reset?.(turnstileId);
          turnstileToken = "";
        }
      },
      estado: (texto) => {
        envioEstado.textContent = texto;
      },
    });
    botonEnviar.disabled = false;
    terminado = true;
    window.clearInterval(temporizador);
    opciones.progreso.borrar();
    window.location.href = destino;
  });

  // ---- Arranque ----
  mostrarPagina(pagina, false);
  form.dataset.listo = "1";
}
