# docs/03-legal — Documentos legales de Atento

Versión 0.1 — 11 de octubre de 2026 — borrador pendiente de revisión legal

Todos los documentos de esta carpeta son **borradores** redactados por el agente legal del proyecto. Ninguno debe publicarse como definitivo sin revisión de un abogado hondureño. Los puntos que requieren confirmación están marcados en el texto con `[CONFIRMAR …]`.

## 1. Índice

| # | Archivo | Para qué sirve | Estado |
|---|---|---|---|
| 1 | `terminos-y-condiciones.md` | Reglas de uso del sitio, licencias, limitación de responsabilidad, jurisdicción | Borrador 0.1 |
| 2 | `politica-de-privacidad.md` | Qué datos se tratan, por qué, dónde, derechos y habeas data | Borrador 0.1 |
| 3 | `aviso-de-salud.md` | Texto corto "no es diagnóstico / no es urgencia" para resultado y pie | Borrador 0.1 |
| 4 | `consentimiento-informado.md` | Pantalla previa con tres confirmaciones; `versionConsentimiento: "2026-10-11"` | Borrador 0.1 |
| 5 | `cookies-y-almacenamiento.md` | Inventario de localStorage, Turnstile y Web Analytics; por qué no hay banner | Borrador 0.1 (claves pendientes del agente técnico) |
| 6 | `accesibilidad.md` | Compromiso WCAG 2.1 AA y canal de reporte | Borrador 0.1 (lista "qué se hizo" pendiente del agente de implementación) |
| 7 | `creditos-y-licencias.md` | Vanderbilt/NICHQ/AAP, ítems CC BY, código MIT, datos CC BY, GeoJSON, imágenes | Borrador 0.1 (imágenes y versión GeoJSON pendientes) |
| 8 | `acuerdo-socio-academico-plantilla.md` | Plantilla de acuerdo de uso de microdatos | Borrador 0.1 |
| 9 | `politica-de-datos-abiertos.md` | Qué se publica, licencia, cita, versionado anual | Borrador 0.1 |
| 10 | `consentimiento-docente.md` | Pantalla previa de la versión docente; `versionConsentimiento: "2026-10-12"`. Sin página legal propia: se muestra en `/docente/consentimiento` y la privacidad lo resume en §13 | Borrador 0.1 |

## 2. Marco legal de referencia (verificado el 2026-10-11)

- **Art. 182 de la Constitución de Honduras**: reconoce la garantía de habeas data (reforma ratificada en 2005). Fuentes secundarias consultadas; se recomienda cotejar el texto literal con la edición oficial de la Constitución y con la Ley sobre Justicia Constitucional (Decreto 244-2003).
- **Art. 76 de la Constitución**: derecho al honor, intimidad personal y familiar y propia imagen.
- **Ley de protección de datos personales**: a agosto de 2026 el anteproyecto (IAIP, presentado en 2015, socializado en el Congreso en 2024) seguía pendiente de dictamen. No se encontró evidencia de aprobación ni publicación en La Gaceta. Si se aprueba, revisar todos los documentos.
- **Ley de Transparencia y Acceso a la Información Pública (Decreto 170-2006)**: solo entes públicos; no aplica.

Fuentes consultadas:
- https://www.dlapiperdataprotection.com/?c=HN&t=law
- https://ifex.org/congress-ratifies-constitutional-reform-establishing-principle-of-habeas-data
- https://www.ecija.com/actualidad-insights/sobre-el-horizonte-de-la-normativa-de-proteccion-de-datos-en-honduras/
- https://www.latribuna.hn/2026/08/10/y-la-ley-de-proteccion-de-datos/
- https://www.elheraldo.hn/honduras/socializan-anteproyecto-ley-proteccion-datos-personales-DC21765161

## 3. Puntos `[CONFIRMAR]` para el abogado

### Identidad y jurisdicción
1. Nombre completo del titular como responsable del tratamiento (todos los documentos).
2. Ciudad para la jurisdicción (propuesta: Tegucigalpa, M.D.C.) — términos y plantilla de acuerdo.
3. Si conviene constituir una figura (asociación, fundación) en lugar de operar a título personal, por la exposición de responsabilidad.

### Constitución y datos
4. Cita literal del art. 182 (habeas data) y del art. 76 con la edición vigente de la Constitución.
5. Vigencia de los artículos de la Ley sobre Justicia Constitucional relativos a habeas data (Decreto 244-2003 y Decreto 10-2013).
6. Estado del anteproyecto de Ley de Protección de Datos Personales a la fecha de publicación.
7. Plazo de respuesta a solicitudes de habeas data (propuesto: 30 días).
8. Régimen aplicable a transferencias internacionales (Cloudflare) y si el titular aceptó el DPA de Cloudflare.

### Responsabilidad y salud
9. Redacción de la limitación de responsabilidad conforme al Código Civil y a la Ley de Protección al Consumidor (Decreto 24-2008), aunque el servicio sea gratuito.
10. Si ofrecer un cribado de salud mental sin profesional responsable requiere algún aviso o registro ante la Secretaría de Salud o la ARSA, o ante colegios profesionales.
11. Línea de emergencia a mostrar (911 y, si procede, línea de salud mental verificada).
12. Si existe validación del Vanderbilt en población hondureña o en español latinoamericano, y cómo redactar la advertencia.

### Propiedad intelectual
13. Condiciones vigentes de uso de la NICHQ Vanderbilt 1ª edición (2002) y de su traducción al español; confirmar que la 2ª edición NO se usa.
14. Origen y derechos de la traducción al español del instrumento.
15. Versión y licencia exacta del GeoJSON (geoBoundaries/HDX).
16. Licencias de fotografías, ilustraciones y tipografías (pendiente del agente de contenido).
17. Si se registra la marca "Atento" en el IPI (opcional).

### Menores y consentimiento
18. Suficiencia del consentimiento del adulto responsable para tratar datos anónimos sobre un menor, y si procede exigir algo más a docentes.
19. Si un cribado con fines de investigación requiere aval previo de un comité de ética en Honduras aunque los datos sean anónimos (por ejemplo, del comité de ética de la UNAH u otra institución).

### Técnico (confirmar con el agente técnico, no con el abogado)
20. Nombres exactos de las claves de localStorage.
21. Que las respuestas sin consentimiento de investigación no se persisten.
22. Generación y alcance del código de vínculo (no debe permitir reidentificación por terceros).
23. 2FA en la cuenta de Cloudflare y región configurada para D1.
24. Existencia del botón "Borrar mi progreso" y que las fuentes se sirven localmente.

## 4. Reglas de versionado de estos documentos

- Cada archivo lleva su versión y fecha en la primera línea bajo el título.
- Un cambio sustantivo en privacidad o consentimiento exige nueva `versionConsentimiento` y, si amplía el uso de los datos, no aplica a datos ya recogidos.
- El historial completo queda en el control de versiones del repositorio.
