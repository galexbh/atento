-- Migración 0003: validaciones adicionales en `respuestas`.
--
-- SQLite no permite añadir CHECK a una tabla existente sin recrearla, así que se usa un trigger
-- BEFORE INSERT equivalente. Las filas ya guardadas no se tocan (solo afecta a inserciones nuevas):
--   - items debe ser JSON válido;
--   - codigo_vinculo es NULL o tiene exactamente 8 caracteres;
--   - version_consentimiento tiene formato AAAA-MM-DD (fecha del texto de consentimiento).
CREATE TRIGGER IF NOT EXISTS trg_respuestas_validar_insert
BEFORE INSERT ON respuestas
BEGIN
  SELECT RAISE(ABORT, 'respuestas.items no es JSON válido')
  WHERE json_valid(NEW.items) <> 1;
  SELECT RAISE(ABORT, 'respuestas.codigo_vinculo debe tener 8 caracteres o ser NULL')
  WHERE NEW.codigo_vinculo IS NOT NULL AND length(NEW.codigo_vinculo) <> 8;
  SELECT RAISE(ABORT, 'respuestas.version_consentimiento debe tener formato AAAA-MM-DD')
  WHERE NEW.version_consentimiento NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]';
END;
