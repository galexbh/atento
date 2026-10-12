/**
 * Validación (zod) del envío de un cuestionario al endpoint de la API.
 *
 * El esquema es estricto: cualquier campo no declarado, cualquier ítem que
 * no pertenezca al instrumento o cualquier municipio que no corresponda al
 * departamento hace fallar la validación.
 */
import { z } from "zod";
import { LONGITUD_MAXIMA_TOKEN } from "@/lib/compartido/turnstile";
import { esMunicipioValido, obtenerDepartamento } from "../catalogo/geo";
import { listarInstrumentos, obtenerInstrumento } from "../puntuacion/instrumentos";
import { RANGO_VALOR } from "../puntuacion/puntuar";

/** UUID v4 (variante RFC 4122). */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CODIGO_VINCULO = /^[A-Za-z0-9]{8}$/;

/** Instrumento de los ítems adicionales opcionales (`respuestasAtento`). */
const INSTRUMENTO_ATENTO = "atento-0.1";

const EsquemaRespuestas = z.record(z.string(), z.number().int());

export const EsquemaEnvio = z
  .object({
    id: z.string().regex(UUID_V4, "id debe ser un UUID v4"),
    instrumentoId: z.string().refine((v) => listarInstrumentos().includes(v), {
      message: "instrumentoId desconocido",
    }),
    respuestas: EsquemaRespuestas,
    /**
     * Ítems adicionales del instrumento "atento-0.1" (A01–A18), intercalados en el
     * cuestionario público. Opcional; se validan contra ese instrumento.
     */
    respuestasAtento: EsquemaRespuestas.optional(),
    departamento: z.string().regex(/^\d{2}$/, "departamento debe tener 2 dígitos"),
    municipio: z.string().regex(/^\d{4}$/, "municipio debe tener 4 dígitos"),
    edadAnios: z.number().int().min(6).max(12),
    sexo: z.enum(["F", "M", "X"]),
    informante: z.enum(["madre", "padre", "cuidador", "docente"]),
    consentimientoInvestigacion: z.boolean(),
    /** Fecha (AAAA-MM-DD) del texto de consentimiento aceptado; ver almacen.VERSION_CONSENTIMIENTO. */
    versionConsentimiento: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "versionConsentimiento debe ser una fecha AAAA-MM-DD"),
    duracionSegundos: z.number().int().min(0).max(86400).optional(),
    completado: z.boolean(),
    /** Id del ítem en el que se abandonó el cuestionario (si no se completó). */
    itemAbandono: z.string().min(1).max(16).optional(),
    codigoVinculo: z
      .string()
      .regex(CODIGO_VINCULO, "codigoVinculo: 8 caracteres alfanuméricos")
      .optional(),
    turnstileToken: z.string().min(1).max(LONGITUD_MAXIMA_TOKEN),
    /** Honeypot: debe venir vacío. */
    hp: z.string().max(0, "hp debe estar vacío"),
  })
  .strict()
  .superRefine((envio, ctx) => {
    // Geografía: departamento del catálogo y municipio que le pertenezca.
    if (!obtenerDepartamento(envio.departamento)) {
      ctx.addIssue({
        code: "custom",
        path: ["departamento"],
        message: "departamento no está en el catálogo",
      });
    } else if (!esMunicipioValido(envio.municipio, envio.departamento)) {
      ctx.addIssue({
        code: "custom",
        path: ["municipio"],
        message: "municipio no existe o no pertenece al departamento",
      });
    }

    // Ítems: solo del instrumento y dentro del rango de su tipo.
    if (!listarInstrumentos().includes(envio.instrumentoId)) return;
    const instrumento = obtenerInstrumento(envio.instrumentoId);
    const items = new Map(instrumento.items.map((i) => [i.id, i]));
    for (const [itemId, valor] of Object.entries(envio.respuestas)) {
      const item = items.get(itemId);
      if (!item) {
        ctx.addIssue({
          code: "custom",
          path: ["respuestas", itemId],
          message: "ítem desconocido",
        });
        continue;
      }
      const rango = RANGO_VALOR[item.tipo];
      if (valor < rango.min || valor > rango.max) {
        ctx.addIssue({
          code: "custom",
          path: ["respuestas", itemId],
          message: `valor fuera de rango (${rango.min}–${rango.max})`,
        });
      }
    }
    if (envio.respuestasAtento) {
      const atento = obtenerInstrumento(INSTRUMENTO_ATENTO);
      const itemsAtento = new Map(atento.items.map((i) => [i.id, i]));
      for (const [itemId, valor] of Object.entries(envio.respuestasAtento)) {
        const item = itemsAtento.get(itemId);
        if (!item) {
          ctx.addIssue({
            code: "custom",
            path: ["respuestasAtento", itemId],
            message: "ítem desconocido",
          });
          continue;
        }
        const rango = RANGO_VALOR[item.tipo];
        if (valor < rango.min || valor > rango.max) {
          ctx.addIssue({
            code: "custom",
            path: ["respuestasAtento", itemId],
            message: `valor fuera de rango (${rango.min}–${rango.max})`,
          });
        }
      }
    }
    if (envio.itemAbandono !== undefined && !items.has(envio.itemAbandono)) {
      ctx.addIssue({
        code: "custom",
        path: ["itemAbandono"],
        message: "itemAbandono no pertenece al instrumento",
      });
    }
  });

export type Envio = z.infer<typeof EsquemaEnvio>;
