# Créditos de imágenes y medios

Registro de todos los recursos gráficos del sitio Atento: origen, autoría, licencia y cambios aplicados. Actualizar este archivo cada vez que se añada, sustituya o elimine una imagen.

Fecha de registro: 2026-10-11.

## 1. Fotografías (`public/img/`)

Todas descargadas de Pexels bajo la [Pexels License](https://www.pexels.com/license/) (uso gratuito, comercial y sin atribución obligatoria; no se permite venderlas sin modificar ni implicar respaldo de las personas retratadas). Se acredita igualmente al autor por cortesía. Cada foto existe en dos tamaños: `nombre.webp` (ancho ~1600 px, o menor si se indica) y `nombre-800.webp` (800 px, para móvil). Conversión a WebP calidad 80 (salvo que se indique) con `sharp` 0.34.3.

| Archivo | Uso previsto | URL original | Autor/a | Plataforma | Licencia | Fecha foto | Cambios aplicados |
|---|---|---|---|---|---|---|---|
| `familia-lectura.webp` / `-800.webp` | Portada: familia leyendo en casa | https://www.pexels.com/photo/mother-with-son-and-daughter-9872961/ | Ron Lach | Pexels | Pexels License | 2021-10-12 | Redimensión a 1600/800 px, WebP q80. Sin recorte. Nota: se ven rostros de dos menores (modelos de banco de imágenes). |
| `aula-primaria.webp` / `-800.webp` | Sección docentes | https://www.pexels.com/photo/cozy-classroom-in-cerro-largo-uruguay-34034655/ | Maria Fonseca Bauza | Pexels | Pexels License | 2025-09-25 | Original vertical 1600×2400; recorte 3:2 (ancho 1600 y 800, recorte automático "attention"), WebP q80. Aula vacía, Cerro Largo (Uruguay), no Honduras. |
| `paisaje-honduras.webp` / `-800.webp` | Fondo/contexto Honduras | https://www.pexels.com/photo/church-building-in-a-city-and-mountains-covered-by-fog-in-the-distance-13863671/ | Jochua Rodas | Pexels | Pexels License | 2022-10-02 | Original vertical 1600×2400; recorte 3:2 anclado abajo (basílica de Suyapa, Tegucigalpa), WebP q80. |
| `madre-hijo-caminando.webp` / `-800.webp` | Página de resultado / gracias | https://www.pexels.com/photo/back-view-of-mother-and-son-walking-on-a-pathway-14018906/ | Atlantic Ambience (@freestockpro) | Pexels | Pexels License | 2022-10-13 | Original vertical; recorte 3:2. Versión grande a 1280 px y q75 para cumplir ≤180 KB (mucho follaje); 800 px q80. Personas de espaldas. Lugar no indicado (probablemente Canarias, no Honduras). |

Descartada: https://www.pexels.com/photo/road-cutting-through-the-town-in-aerial-view-15778612/ (Luis Quintero, San Pedro Sula, Pexels License). Vista aérea con tanto detalle que no bajó de 180 KB ni a 1200 px / q55; se puede recuperar si se acepta un peso mayor.

Búsquedas realizadas también en Unsplash y Openverse; Unsplash bloqueó las descargas automatizadas (reto anti-bot) y los resultados relevantes eran en su mayoría Unsplash+ (licencia de pago), por lo que se optó por Pexels.

## 2. Datos geográficos (`public/geo/`)

| Archivo | Fuente | Versión | Licencia | Cambios |
|---|---|---|---|---|
| `honduras-departamentos.geojson` (28 KB) | geoBoundaries, gbOpen, HND ADM1 — https://www.geoboundaries.org/api/current/gbOpen/HND/ADM1/ (archivo `geoBoundaries-HND-ADM1_simplified.geojson`, commit `9469f09`) | Build 2023-12-12; datos base OpenStreetMap / Wambacher, año representado 2017 | ODbL 1.0 (Open Data Commons Open Database License). Atribución requerida: "geoBoundaries (Runfola et al., 2020)" y "© colaboradores de OpenStreetMap" | Simplificación con mapshaper 0.7.83 (Visvalingam 12 %, `keep-shapes`), islas < 4 km² eliminadas, precisión 0,001°, propiedades reemplazadas por `codigo` (INE 01–18), `nombre` e `iso`. Metadatos de fuente dentro del propio archivo. |

Cita sugerida: Runfola, D. et al. (2020). geoBoundaries: A global database of political administrative boundaries. PLoS ONE 15(4): e0231866.

## 3. Ilustraciones propias (`public/ilustraciones/`)

Dibujadas a mano en SVG para este proyecto por el equipo de Atento (agente de gráficos), 2026-10-11. Sin material de terceros. Se publican bajo la misma licencia del repositorio. Colores mediante `var(--c-…, fallback)` para permitir retematizar: `--c-primario`, `--c-acento`, `--c-verde`, `--c-coral`, `--c-texto`, `--c-ilus-fondo`; el mapa usa `--c-mapa-relleno` y `--c-mapa-borde`. Los iconos de `iconos/` usan `currentColor`.

`honduras.svg` deriva de los datos geoBoundaries anteriores (misma licencia ODbL y atribución), proyección Web Mercator, un `<path>` por departamento con `id="d-01"`…`d-18` y `data-nombre`.

## 4. Marca (`public/marca/`)

Símbolo y logotipo creados para el proyecto (2026-10-11). La palabra "Atento" usa tipografía del sistema (`system-ui`, Segoe UI, Roboto, Helvetica, Arial), no incrustada; los PNG (`icono-192.png`, `icono-512.png`, `og-default.png`) se exportaron con sharp/librsvg, donde el texto se renderizó con la fuente del sistema Windows (Segoe UI).

## 5. Contraste (WCAG 2.1) sobre la paleta provisional

| Par | Ratio | AA texto normal (≥4.5) | AA texto grande / UI (≥3) |
|---|---|---|---|
| Texto `#1E2A32` / crema `#F7F4EE` | 13.35 | Sí | Sí |
| Texto / blanco | 14.66 | Sí | Sí |
| Primario `#1F6F8B` / crema | 5.16 | Sí | Sí |
| Blanco / primario (botones) | 5.67 | Sí | Sí |
| Texto / ámbar `#F2A541` | 7.14 | Sí | Sí |
| Texto / verde `#6BBF8E` | 6.61 | Sí | Sí |
| Ámbar / crema | 1.87 | No | No |
| Verde / crema | 2.02 | No | No |
| Coral `#E8705F` / crema | 2.77 | No | No |
| Blanco / coral | 3.04 | No | Solo grande/UI |

Conclusión: ámbar, verde y coral sirven como relleno decorativo o con texto oscuro encima, no como color de texto sobre crema ni como fondo de botón con texto blanco (coral queda al límite). El primario y el texto cumplen AA en todas las combinaciones.
