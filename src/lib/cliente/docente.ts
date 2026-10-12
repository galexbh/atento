/**
 * Lógica de cliente del flujo docente (/docente/*).
 *
 * - `iniciarCuestionarioDocente`: usa el motor compartido con la familia; al terminar construye
 *   la hoja imprimible (solo conteos de SUS respuestas, sin nivel) y, si el docente autorizó
 *   investigación, envía a POST /api/respuesta con `informante: "docente"` y el código de
 *   vínculo (si lo tiene). Sin esa autorización no sale nada del dispositivo.
 * - `iniciarHojaDocente`: pinta la hoja en /docente/gracias y conecta "Imprimir o guardar PDF".
 *
 * Al docente nunca se le muestra nivel, umbrales ni interpretación: ni el cliente los calcula
 * para mostrarlos ni el servidor los devuelve (responde `{ok:true}` sin `nivel`).
 */
import { formatearCodigo } from "@/lib/compartido/codigo-vinculo";
import { INSTRUMENTO_DOCENTE, obtenerInstrumento } from "@/lib/puntuacion/instrumentos";
import { almacenDocente, VERSION_CONSENTIMIENTO_DOCENTE } from "./almacen";
import { construirHojaDocente, NOMBRE_ESCALA_HOJA } from "./hoja-docente";
import { enviarRespuesta, iniciarMotorCuestionario } from "./motor-cuestionario";

export function iniciarCuestionarioDocente(raiz: HTMLElement): void {
  const consentimiento = almacenDocente.leerConsentimiento();
  const datos = almacenDocente.leerDatos();
  if (!consentimiento) {
    window.location.replace("/docente/consentimiento");
    return;
  }
  if (!datos) {
    window.location.replace("/docente/datos");
    return;
  }
  const instrumentoId = raiz.dataset.instrumento ?? INSTRUMENTO_DOCENTE;
  const conInvestigacion = Boolean(consentimiento.investigacion);

  iniciarMotorCuestionario(raiz, {
    progreso: {
      leer: almacenDocente.leerProgreso,
      guardar: almacenDocente.guardarProgreso,
      borrar: almacenDocente.borrarProgreso,
    },
    rutaDatos: "/docente/datos",
    conInvestigacion,
    textosEnvio: conInvestigacion
      ? {
          texto:
            "Autorizaste guardar tus respuestas, de forma anónima, para investigación. Confirma que eres una persona y verás la hoja para imprimir.",
          nota: "Si el envío falla, igual podrás imprimir la hoja: se genera en este dispositivo.",
        }
      : {
          texto:
            "No autorizaste el uso para investigación, así que tus respuestas no salen de este dispositivo.",
          nota: "La hoja para imprimir se genera aquí mismo.",
        },
    textoErrorTurnstile:
      "No se pudo cargar la verificación antibots. Puedes ver la hoja igual; no se guardará tu respuesta.",
    alEnviar: async ({ respuestas, segundos, hp, turnstileToken, reiniciarTurnstile, estado }) => {
      let guardado = false;
      if (conInvestigacion) {
        estado("Guardando tu respuesta…");
        const cuerpo: Record<string, unknown> = {
          id: crypto.randomUUID(),
          instrumentoId,
          respuestas,
          departamento: datos.departamento,
          municipio: datos.municipio,
          edadAnios: datos.edadAnios,
          sexo: datos.sexo,
          informante: "docente",
          consentimientoInvestigacion: true,
          versionConsentimiento: consentimiento.version ?? VERSION_CONSENTIMIENTO_DOCENTE,
          duracionSegundos: Math.min(86_400, Math.max(0, Math.round(segundos))),
          completado: true,
          turnstileToken: turnstileToken || "sin-token",
          hp,
        };
        if (datos.codigoVinculo) cuerpo.codigoVinculo = datos.codigoVinculo;
        guardado = await enviarRespuesta(cuerpo);
        if (!guardado) reiniciarTurnstile();
      }
      almacenDocente.guardarHoja(
        construirHojaDocente({
          instrumentoId,
          respuestas,
          edadAnios: datos.edadAnios,
          codigoVinculo: datos.codigoVinculo,
          investigacion: conInvestigacion,
          guardado,
        }),
      );
      // El código es de UN niño: no debe pasar al siguiente cuestionario que llene este docente.
      almacenDocente.borrarCodigo();
      almacenDocente.guardarDatos({ ...datos, codigoVinculo: null });
      estado("Listo. Abriendo la hoja para imprimir…");
      return "/docente/gracias";
    },
  });
}

function escapar(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

export function iniciarHojaDocente(raiz: HTMLElement): void {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const hoja = almacenDocente.leerHoja();
  if (!hoja) {
    $("sin-hoja").hidden = false;
    return;
  }
  $("con-hoja").hidden = false;
  const instrumento = obtenerInstrumento(hoja.instrumentoId);

  $("hoja-fecha").textContent = new Date(hoja.fecha).toLocaleDateString("es-HN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  $("hoja-edad").textContent = `${hoja.edadAnios} años`;
  $("hoja-codigo").textContent = hoja.codigoVinculo
    ? formatearCodigo(hoja.codigoVinculo)
    : "Sin código";

  const estado = $<HTMLElement>("estado-guardado");
  if (hoja.investigacion) {
    estado.hidden = false;
    estado.textContent = hoja.guardado
      ? "Gracias: tu respuesta anónima se guardó para investigación."
      : "No se pudo guardar tu respuesta para investigación, pero aquí está tu hoja. Puedes imprimirla igual.";
  }

  $("hoja-escalas").innerHTML = hoja.escalas
    .map((e) => {
      const items = instrumento.items.filter((i) => i.escala === e.escala);
      const desde = items[0]?.orden ?? 0;
      const hasta = items[items.length - 1]?.orden ?? 0;
      const nombre = NOMBRE_ESCALA_HOJA[e.escala] ?? e.escala;
      const sin = e.respondidos < e.total ? ` (${e.total - e.respondidos} sin responder)` : "";
      return `<tr><th scope="row">${escapar(nombre)} <span class="hoja__rango">preguntas ${desde}–${hasta}</span></th><td>${e.marcados} de ${e.total}${sin}</td></tr>`;
    })
    .join("");

  const lista = $<HTMLElement>("hoja-desempeno");
  lista.innerHTML = hoja.desempenoConDificultad.length
    ? hoja.desempenoConDificultad
        .map(
          (d) =>
            `<li><span class="hoja__num">${d.numero}.</span> ${escapar(d.texto)}: <strong>${escapar(d.etiqueta.toLowerCase())}</strong></li>`,
        )
        .join("")
    : `<li>Ninguna área marcada con «cierta dificultad» o «con dificultad».</li>`;

  $<HTMLButtonElement>("imprimir").addEventListener("click", () => window.print());
  raiz.dataset.listo = "1";
}
