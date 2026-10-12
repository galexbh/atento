-- Migración 0005: versión docente (2026-10-12).
--
-- El reporte de concordancia padre–docente del panel empareja filas por `codigo_vinculo`
-- (familia + docente con el mismo código). Índice parcial: solo las filas que tienen código.
-- No cambia el esquema: el docente usa las mismas columnas (informante = 'docente',
-- version_instrumento = 'vanderbilt-docente-es-1.0'); el trigger de 0003 ya exige 8 caracteres.
CREATE INDEX IF NOT EXISTS idx_respuestas_codigo_vinculo
  ON respuestas (codigo_vinculo)
  WHERE codigo_vinculo IS NOT NULL;
