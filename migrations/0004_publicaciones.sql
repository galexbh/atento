-- Migración 0004: publicaciones públicas versionadas (/datos y /api/publico/*).
--
-- Una fila por año y versión con el JSON ya suprimido (supresión primaria y complementaria,
-- ver src/lib/publico/datos.ts). El año en curso se guarda como version = 'preliminar' y se
-- sobrescribe en cada recálculo; al cerrarse el año se crea version = 'v1', que no se modifica
-- nunca más (las correcciones irían como 'v2', ...), y se borra la preliminar de ese año.
CREATE TABLE IF NOT EXISTS publicaciones (
  anio INTEGER NOT NULL,
  version TEXT NOT NULL,
  preliminar INTEGER NOT NULL DEFAULT 1 CHECK (preliminar IN (0, 1)),
  datos TEXT NOT NULL CHECK (json_valid(datos)),
  generado_en TEXT NOT NULL,
  PRIMARY KEY (anio, version)
);

-- Inmutabilidad de las versiones cerradas: no se pueden modificar. El borrado se permite solo
-- para retirar un dataset por riesgo de reidentificación (política de datos abiertos, §8).
CREATE TRIGGER IF NOT EXISTS trg_publicaciones_inmutable_update
BEFORE UPDATE ON publicaciones
WHEN OLD.version <> 'preliminar'
BEGIN
  SELECT RAISE(ABORT, 'publicaciones: una versión cerrada no se modifica');
END;
