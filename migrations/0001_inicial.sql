-- Migración 0001: esquema inicial de Atento.
-- Convenciones: fechas en TEXT ISO (YYYY-MM-DD para creado_en, sin hora, para reducir
-- identificabilidad); booleanos como INTEGER 0/1; JSON como TEXT.

-- Respuestas individuales al cuestionario (una fila por cribado). Sin datos identificables.
CREATE TABLE IF NOT EXISTS respuestas (
  id TEXT PRIMARY KEY,
  creado_en TEXT NOT NULL CHECK (length(creado_en) = 10),
  periodo_anio INTEGER NOT NULL,
  departamento TEXT NOT NULL CHECK (length(departamento) = 2),
  municipio TEXT NOT NULL CHECK (length(municipio) = 4),
  edad_anios INTEGER NOT NULL CHECK (edad_anios BETWEEN 6 AND 12),
  sexo TEXT CHECK (sexo IN ('F', 'M', 'X')),
  informante TEXT CHECK (informante IN ('madre', 'padre', 'cuidador', 'docente')),
  items TEXT NOT NULL,
  punt_inatencion INTEGER,
  punt_hiperactividad INTEGER,
  punt_oposicion INTEGER,
  punt_conducta INTEGER,
  punt_ansiedad_depresion INTEGER,
  punt_desempeno INTEGER,
  pos_inatencion INTEGER CHECK (pos_inatencion IN (0, 1)),
  pos_hiperactividad INTEGER CHECK (pos_hiperactividad IN (0, 1)),
  pos_oposicion INTEGER CHECK (pos_oposicion IN (0, 1)),
  pos_conducta INTEGER CHECK (pos_conducta IN (0, 1)),
  pos_ansiedad_depresion INTEGER CHECK (pos_ansiedad_depresion IN (0, 1)),
  pos_desempeno INTEGER CHECK (pos_desempeno IN (0, 1)),
  nivel TEXT CHECK (nivel IN ('bajo', 'moderado', 'alto')),
  consentimiento_investigacion INTEGER NOT NULL DEFAULT 0 CHECK (consentimiento_investigacion IN (0, 1)),
  version_consentimiento TEXT NOT NULL,
  version_instrumento TEXT NOT NULL,
  duracion_segundos INTEGER,
  completado INTEGER NOT NULL DEFAULT 1 CHECK (completado IN (0, 1)),
  item_abandono TEXT,
  codigo_vinculo TEXT
);

CREATE INDEX IF NOT EXISTS idx_respuestas_periodo_anio ON respuestas (periodo_anio);
CREATE INDEX IF NOT EXISTS idx_respuestas_departamento ON respuestas (departamento);
CREATE INDEX IF NOT EXISTS idx_respuestas_municipio ON respuestas (municipio);
CREATE INDEX IF NOT EXISTS idx_respuestas_version_instrumento ON respuestas (version_instrumento);
CREATE INDEX IF NOT EXISTS idx_respuestas_creado_en ON respuestas (creado_en);

-- Agregados por municipio y periodo (recalculados por el cron). Filas con n pequeño se suprimen.
CREATE TABLE IF NOT EXISTS agregados_municipio (
  periodo TEXT NOT NULL,
  departamento TEXT NOT NULL,
  municipio TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  pct_inatencion REAL,
  pct_hiperactividad REAL,
  pct_combinado REAL,
  ic95_inf REAL,
  ic95_sup REAL,
  suprimido INTEGER NOT NULL DEFAULT 0 CHECK (suprimido IN (0, 1)),
  version_instrumento TEXT NOT NULL,
  calculado_en TEXT NOT NULL,
  PRIMARY KEY (periodo, municipio, version_instrumento)
);

-- Agregados anuales publicados como dataset abierto, versionados.
CREATE TABLE IF NOT EXISTS agregados_anuales (
  periodo TEXT NOT NULL,
  departamento TEXT NOT NULL,
  municipio TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  pct_inatencion REAL,
  pct_hiperactividad REAL,
  pct_combinado REAL,
  ic95_inf REAL,
  ic95_sup REAL,
  suprimido INTEGER NOT NULL DEFAULT 0 CHECK (suprimido IN (0, 1)),
  version_instrumento TEXT NOT NULL,
  version_dataset TEXT NOT NULL,
  calculado_en TEXT NOT NULL,
  PRIMARY KEY (periodo, municipio, version_dataset)
);

-- Psicometría por ítem (consistencia interna del instrumento).
CREATE TABLE IF NOT EXISTS agregados_psicometria (
  periodo TEXT NOT NULL,
  version_instrumento TEXT NOT NULL,
  item_id TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  media REAL,
  tasa_respaldo REAL,
  corr_item_total REAL,
  alfa_sin_item REAL,
  PRIMARY KEY (periodo, version_instrumento, item_id)
);

-- Bitácora de acciones administrativas (exportaciones, cambios de configuración).
CREATE TABLE IF NOT EXISTS auditoria_admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha_hora TEXT NOT NULL,
  usuario TEXT NOT NULL,
  accion TEXT NOT NULL,
  filtros TEXT,
  filas INTEGER
);

-- Configuración clave/valor (p. ej. mantenimiento = '1' activa el modo mantenimiento).
CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT
);

INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('mantenimiento', '0');
