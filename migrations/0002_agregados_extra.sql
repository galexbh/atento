-- Migración 0002: columnas adicionales de agregados.
--
-- pct_combinado (0001) se define como el % de cribados con inatención O hiperactividad positiva
-- ("cualquiera de las dos", es decir, con indicadores de TDAH). pct_ambas añade el % con las dos
-- escalas positivas a la vez (presentación combinada), que es lo que `puntuar()` llama `combinado`.
-- Ambas se calculan sobre cribados completados; con n < 5 se guardan en NULL (suprimido = 1).
ALTER TABLE agregados_municipio ADD COLUMN pct_ambas REAL;
ALTER TABLE agregados_anuales ADD COLUMN pct_ambas REAL;
