/**
 * Lógica de cliente del cuestionario (/cribado/cuestionario).
 *
 * - Los 72 ítems ya vienen en el HTML (fieldsets con data-pagina); aquí solo se muestran por
 *   páginas de 6, se guarda el progreso (`atento:progreso`) y se restaura.
 * - Cronómetro: cuenta segundos mientras la pestaña está visible (duracionSegundos).
 * - Al terminar: se puntúa EN CLIENTE con `puntuar()` (solo ítems Vanderbilt; los Atento se
 *   envían aparte en `respuestasAtento`), se guarda `atento:resultado` (sin ítems) y, si la
 *   persona autorizó investigación, se envía a POST /api/respuesta con Turnstile + honeypot.
 *   Si el envío falla, el resultado se muestra igual con un aviso.
 * - Sin consentimiento de investigación no se envía nada: las respuestas no salen del dispositivo.
 */
import { INSTRUMENTO_ACTUAL } from "@/lib/puntuacion/instrumentos";
import { ESCALAS, puntuar } from "@/lib/puntuacion/puntuar";
import {
  almacen,
  formatearCodigo,
  generarCodigoVinculo,
  type Progreso,
  type ResultadoGuardado,
  VERSION_CONSENTIMIENTO,
} from "./almacen";
import { INSTRUMENTO_ATENTO } from "./orden";

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

export function iniciarCuestionario(raiz: HTMLElement): void {
  const consentimiento = almacen.leerConsentimiento();
  const datos = almacen.leerDatos();
  if (!consentimiento) {
    window.location.replace("/cribado/consentimiento");
    return;
  }
  if (!datos) {
    window.location.replace("/cribado/datos");
    return;
  }

  const totalPaginas = Number(raiz.dataset.paginas);
  const totalItems = Number(raiz.dataset.items);
  const instrumentoId = raiz.dataset.instrumento ?? INSTRUMENTO_ACTUAL;
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
  const previo = almacen.leerProgreso();
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
    const progreso: Progreso = {
      instrumentoId,
      respuestas,
      pagina,
      segundos,
      actualizado: new Date().toISOString(),
    };
    almacen.guardarProgreso(progreso);
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
      window.location.href = "/cribado/datos";
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
    if (consentimiento?.investigacion) {
      envioTexto.textContent =
        "Autorizaste usar tus respuestas, de forma anónima, para el mapa nacional. Confirma que eres una persona y verás tu resultado.";
      envioNota.textContent =
        "Si el envío falla, igual verás tu resultado: se calcula en tu teléfono.";
      cargarTurnstile();
    } else {
      envioTexto.textContent =
        "No autorizaste el uso para investigación, así que tus respuestas no salen de este dispositivo.";
      envioNota.textContent = "El resultado se calcula aquí mismo.";
    }
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
      envioEstado.textContent =
        "No se pudo cargar la verificación antibots. Puedes ver tu resultado igual; no se guardará tu respuesta.";
    });
    document.head.appendChild(script);
  }

  function renderizarTurnstile(): void {
    if (typeof window.turnstile?.render !== "function" || turnstileId !== undefined) return;
    turnstileId = window.turnstile.render(contenedorTurnstile, {
      sitekey: claveTurnstile,
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

  // ---- Puntuación y envío ----
  function separarRespuestas(): {
    principal: Record<string, number>;
    atento: Record<string, number>;
  } {
    const principal: Record<string, number> = {};
    const atento: Record<string, number> = {};
    for (const el of items) {
      const id = el.dataset.id as string;
      const valor = respuestas[id];
      if (valor === undefined) continue;
      if (el.dataset.instrumento === INSTRUMENTO_ATENTO) atento[id] = valor;
      else principal[id] = valor;
    }
    return { principal, atento };
  }

  async function enviar(envioJson: Record<string, unknown>): Promise<boolean> {
    try {
      const r = await fetch("/api/respuesta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(envioJson),
      });
      return r.ok;
    } catch {
      return false;
    }
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (botonEnviar.disabled) return;
    tick();
    const hp = (form.elements.namedItem("hp") as HTMLInputElement | null)?.value ?? "";
    const { principal, atento } = separarRespuestas();
    const id = crypto.randomUUID();
    const codigoVinculo = generarCodigoVinculo();

    // 1) Resultado en cliente (siempre).
    const resultado = puntuar({ instrumentoId, respuestas: principal });
    const faltanNucleo = [resultado.escalas.inatencion, resultado.escalas.hiperactividad].filter(
      (e) => e.total - e.respondidos > 0,
    ).length;
    const guardado: ResultadoGuardado = {
      id,
      instrumentoId,
      versionInstrumento: raiz.dataset.version ?? "",
      nivel: resultado.nivel,
      combinado: resultado.combinado,
      alertas: resultado.alertas,
      escalas: ESCALAS.map((escala) => {
        const e = resultado.escalas[escala];
        return {
          escala,
          positivosCriterio: e.positivosCriterio,
          umbral: e.umbral,
          total: e.total,
          respondidos: e.respondidos,
          puntaje: e.puntaje,
          positivo: e.positivo,
        };
      }),
      itemsFaltantes: resultado.itemsFaltantes.length,
      faltanSintomas: faltanNucleo === 0 ? "ninguna" : faltanNucleo === 2 ? "total" : "parcial",
      codigoVinculo,
      guardado: false,
      investigacion: Boolean(consentimiento?.investigacion),
      fecha: new Date().toISOString(),
      edadAnios: datos.edadAnios,
      informante: datos.informante,
      duracionSegundos: segundos,
    };

    // 2) Envío opcional.
    if (consentimiento?.investigacion) {
      if (!turnstileToken && typeof window.turnstile?.render === "function") {
        envioEstado.textContent = "Completa la verificación antibots para continuar.";
        return;
      }
      botonEnviar.disabled = true;
      envioEstado.textContent = "Guardando tu respuesta…";
      const ok = await enviar({
        id,
        instrumentoId,
        respuestas: principal,
        respuestasAtento: atento,
        departamento: datos.departamento,
        municipio: datos.municipio,
        edadAnios: datos.edadAnios,
        sexo: datos.sexo,
        informante: datos.informante,
        consentimientoInvestigacion: true,
        versionConsentimiento: consentimiento.version ?? VERSION_CONSENTIMIENTO,
        duracionSegundos: Math.min(86_400, Math.max(0, Math.round(segundos))),
        completado: true,
        codigoVinculo,
        turnstileToken: turnstileToken || "sin-token",
        hp,
      });
      guardado.guardado = ok;
      botonEnviar.disabled = false;
    }

    terminado = true;
    window.clearInterval(temporizador);
    almacen.guardarResultado(guardado);
    almacen.borrarProgreso();
    envioEstado.textContent = `Tu código de vínculo es ${formatearCodigo(codigoVinculo)}. Abriendo tu resultado…`;
    window.location.href = "/resultado";
  });

  // ---- Arranque ----
  mostrarPagina(pagina, false);
  form.dataset.listo = "1";
}
