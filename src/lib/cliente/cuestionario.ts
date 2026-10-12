/**
 * Lógica de cliente del cuestionario de la familia (/cribado/cuestionario).
 *
 * La paginación, el progreso, el cronómetro y Turnstile viven en `motor-cuestionario.ts`
 * (compartido con el flujo docente). Aquí solo lo propio de la familia:
 * - Al terminar se puntúa EN CLIENTE con `puntuar()` (solo ítems Vanderbilt; los Atento se
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
  type ResultadoGuardado,
  VERSION_CONSENTIMIENTO,
} from "./almacen";
import { enviarRespuesta, iniciarMotorCuestionario } from "./motor-cuestionario";
import { INSTRUMENTO_ATENTO } from "./orden";

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
  const instrumentoId = raiz.dataset.instrumento ?? INSTRUMENTO_ACTUAL;
  const conInvestigacion = Boolean(consentimiento.investigacion);

  iniciarMotorCuestionario(raiz, {
    progreso: {
      leer: almacen.leerProgreso,
      guardar: almacen.guardarProgreso,
      borrar: almacen.borrarProgreso,
    },
    rutaDatos: "/cribado/datos",
    conInvestigacion,
    textosEnvio: conInvestigacion
      ? {
          texto:
            "Autorizaste usar tus respuestas, de forma anónima, para el mapa nacional. Confirma que eres una persona y verás tu resultado.",
          nota: "Si el envío falla, igual verás tu resultado: se calcula en tu teléfono.",
        }
      : {
          texto:
            "No autorizaste el uso para investigación, así que tus respuestas no salen de este dispositivo.",
          nota: "El resultado se calcula aquí mismo.",
        },
    textoErrorTurnstile:
      "No se pudo cargar la verificación antibots. Puedes ver tu resultado igual; no se guardará tu respuesta.",
    alEnviar: async ({
      respuestas,
      items,
      segundos,
      hp,
      turnstileToken,
      reiniciarTurnstile,
      estado,
    }) => {
      // Separa los ítems Vanderbilt de los ítems Atento intercalados.
      const principal: Record<string, number> = {};
      const atento: Record<string, number> = {};
      for (const el of items) {
        const itemId = el.dataset.id as string;
        const valor = respuestas[itemId];
        if (valor === undefined) continue;
        if (el.dataset.instrumento === INSTRUMENTO_ATENTO) atento[itemId] = valor;
        else principal[itemId] = valor;
      }
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
        investigacion: conInvestigacion,
        fecha: new Date().toISOString(),
        edadAnios: datos.edadAnios,
        informante: datos.informante,
        duracionSegundos: segundos,
      };

      // 2) Envío opcional.
      if (conInvestigacion) {
        estado("Guardando tu respuesta…");
        const ok = await enviarRespuesta({
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
        // Los tokens son de un solo uso: si el envío falló, se pide uno nuevo antes de reintentar.
        if (!ok) reiniciarTurnstile();
      }

      almacen.guardarResultado(guardado);
      estado(`Tu código de vínculo es ${formatearCodigo(codigoVinculo)}. Abriendo tu resultado…`);
      return "/resultado";
    },
  });
}
