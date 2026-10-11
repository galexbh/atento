# Política de datos abiertos

Versión 0.1 — 11 de octubre de 2026 — borrador pendiente de revisión legal

## 1. Principio

Atento recoge datos con la ayuda de la comunidad. Por eso los devuelve a la comunidad: todo lo que pueda publicarse sin riesgo para las personas se publica en formato abierto.

## 2. Qué se publica

| Dataset | Contenido | Formato |
|---|---|---|
| Agregados por departamento | Número de respuestas, distribución por edad, sexo y tipo de informante, porcentaje por categoría de resultado | CSV, JSON |
| Agregados por municipio | Lo mismo, **solo para municipios con 5 o más respuestas** | CSV, JSON, GeoJSON |
| Diccionario de datos | Descripción de cada variable | Markdown |
| Instrumento | Ítems propios de Atento (no el texto Vanderbilt) | Markdown |

Los municipios con menos de 5 respuestas aparecen como "suprimido" y se suman al total del departamento.

## 3. Qué NO se publica

- Microdatos (fila por fila). Solo se comparten con un socio académico bajo acuerdo y comité de ética.
- Cualquier tabla cruzada que genere celdas con menos de 5 observaciones.
- Fechas con precisión mayor a mes.
- Datos técnicos (hashes, tokens).

## 4. Licencia

Todos los datasets publicados se ofrecen bajo **Creative Commons Atribución 4.0 Internacional (CC BY 4.0)**. Puedes copiar, redistribuir, transformar y usar con cualquier fin, incluso comercial, siempre que cites la fuente e indiques si hiciste cambios.

La licencia no cubre el texto del cuestionario Vanderbilt (ver `creditos-y-licencias.md`).

## 5. Cómo citar Atento

Formato general:

> Atento (`[año]`). *Datos agregados de cribado comunitario de TDAH en Honduras, versión `[AAAA]`*. https://atento.galexbh.dev/datos. Licencia CC BY 4.0.

Ejemplo:

> Atento (2027). *Datos agregados de cribado comunitario de TDAH en Honduras, versión 2027*. https://atento.galexbh.dev/datos. Licencia CC BY 4.0.

Formato BibTeX:

```bibtex
@misc{atento2027,
  title   = {Datos agregados de cribado comunitario de TDAH en Honduras, versión 2027},
  author  = {{Atento}},
  year    = {2027},
  url     = {https://atento.galexbh.dev/datos},
  note    = {Licencia CC BY 4.0}
}
```

`[CONFIRMAR si el titular desea figurar con su nombre como autor del dataset]`

## 6. Advertencia de uso

Los datos provienen de un cribado voluntario, no de una muestra representativa. No miden prevalencia de TDAH. Toda interpretación debe tener en cuenta sesgos de autoselección, acceso a internet y cobertura desigual por región. Cada dataset incluye esta advertencia en su diccionario.

## 7. Versionado

- Se publica una **versión anual** del dataset, identificada por el año (por ejemplo, `2027`), con corte al 31 de diciembre. `[CONFIRMAR fecha de corte]`
- Las versiones anteriores se conservan y no se modifican; si hay una corrección, se publica una versión `AAAA.1` con nota de cambios.
- El mapa del sitio puede mostrar datos más recientes que el último dataset anual; en ese caso se indica "datos preliminares".
- Cada versión registra: fecha de corte, número total de respuestas, versión del instrumento y del consentimiento, y reglas de supresión aplicadas.

## 8. Retiro de datos

Como los datasets son anónimos y agregados, no se retiran por solicitudes individuales. Si se detecta un riesgo de reidentificación, el dataset afectado se retira y se publica una versión corregida.

## 9. Contacto

`info@galexbh.dev`
