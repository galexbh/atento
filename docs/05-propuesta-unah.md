# Propuesta de alianza de investigación: Atento × UNAH

**Proyecto:** Atento – cribado comunitario de TDAH en niños de 6–12 años y mapa anónimo nacional
**Proponente:** Gabriel (desarrollador independiente), info@galexbh.dev, https://atento.galexbh.dev
**Dirigida a:** Universidad Nacional Autónoma de Honduras (UNAH) – Facultad de Ciencias Médicas (Departamento de Psiquiatría, Departamento de Pediatría, Unidad de Investigación Científica, Comité de Ética en Investigación Biomédica) y Escuela de Ciencias Psicológicas (Unidad de Gestión de la Investigación Científica)
**Versión:** borrador 0.1, 2026-10-11. Pendiente de revisión por asesor clínico antes de enviarse.

---

## 1. Resumen

Atento es una plataforma web gratuita, de código abierto y sin fines de lucro que permite a madres, padres y cuidadores responder un cuestionario de cribado de TDAH (NICHQ Vanderbilt Assessment Scale – Parent Informant, 1.ª ed., versión en español) más 18 ítems propios, recibir una orientación inmediata ("conviene consultar / no se observan indicadores") y, de forma anónima, contribuir a un mapa nacional de resultados agregados por municipio y año. El sistema no diagnostica, no usa inteligencia artificial y no recopila datos identificables.

Honduras carece de datos poblacionales sobre TDAH infantil: la evidencia disponible se reduce a tres estudios locales con muestras pequeñas y metodologías heterogéneas, con prevalencias reportadas entre 5.8 % y 36 %. Proponemos a la UNAH una alianza para (a) validar el instrumento Atento frente a la escala Vanderbilt y frente a evaluación clínica, (b) dar gobernanza ética y científica a los datos agregados y (c) producir las primeras normas locales de referencia y un informe anual. Atento aporta plataforma, datos y código; pedimos a la UNAH asesoría clínica, revisión ética, estudiantes investigadores y coautoría.

## 2. Problema: ausencia de datos sobre TDAH infantil en Honduras

### 2.1 Lo que existe (búsqueda realizada el 2026-10-11)

| Estudio | Diseño y muestra | Instrumento | Resultado | Limitación para uso poblacional |
|---|---|---|---|---|
| García J, Valladares E. *Estudio clínico-epidemiológico del síndrome de perturbación de la atención e hiperactividad en niños atendidos en el Hospital Escuela, Tegucigalpa.* Rev Med Hond 2002;70:159-163. https://www.revistamedicahondurena.hn/assets/Uploads/Vol70-4-2002.pdf | Descriptivo transversal, 120 niños de 5–14 años atendidos en consulta externa (1999–2001) | Entrevista clínica, evaluación psiquiátrica, cuestionarios a padres y maestros | 86 % varones; 88 % de la región central; subtipo combinado 94 % | Muestra clínica (casos ya referidos), no estima prevalencia |
| Duarte ZE, Reyes E, Sosa AL, et al. *Prevalencia de TDAH, relación con reprobación escolar y estado nutricional en población escolar del Distrito Central.* Rev Post Med UNAH 2010;13(3):1-10 (citado en Mendoza Contreras 2018; PDF original no accesible en la búsqueda) | 600 escolares de 6–13 años, 10 centros, muestreo aleatorio | "Escala de detección del TDAH" (no especificada en la cita) | Prevalencia 11.73 %; relación M:F 2:1; reprobación 24.6 % asociada | Resultado de cribado, no diagnóstico confirmado; fuente secundaria |
| Pineda Santos MA. *Trastorno por déficit de atención e hiperactividad en las escuelas de San Pedro Sula, 2016.* Tesis de posgrado de Pediatría, UNAH-VS, 2016. https://www.bvs.hn/TMVS/pdf/TMVS34/pdf/TMVS34.pdf | 220 niños preseleccionados por 75 maestros en 9 escuelas públicas (jornada matutina, distritos 21 y 22) | Test de Conners (padres y maestros) y cuestionario DSM-5 | Prevalencia 5.8 % en la población escolar (1,844); 51 % Conners positivo entre preseleccionados | Muestreo por conveniencia; preselección docente; una sola ciudad |
| Mendoza Contreras NE, Pineda LM, Velásquez MR. *Rendimiento académico y TDAH en escuelas de El Progreso, Yoro, 2018.* Acta Pediátrica Hondureña 2018;9(1):879-888. https://www.bvs.hn/APH/pdf/APHVol9/pdf/APHVol9-1-2018-6.pdf | Transversal analítico, 300 escolares de 6–12 años, 4 escuelas públicas | Test de Conners (padres y maestros) y cuestionario DSM-5 | "Prevalencia" 36 % (108/300); 64 % sin diagnóstico previo | Cifra incompatible con la literatura internacional; probable cribado positivo, no diagnóstico; un municipio |
| Galdámez G, Rodríguez I, Castellanos N, et al. *Alta prevalencia de discapacidad intelectual y de comportamiento en niños de 2-17 años, Honduras 2017.* Rev Med Hond 2022;90(2):121-129. https://portal.amelica.org/ameli/journal/470/4704178006/html/ | Transversal nacional, 15,511 niños | Módulo de Funcionamiento Infantil Washington Group/UNICEF | Discapacidad global 8.96 % (IC95 % 8.5–9.4); dominios atención, comportamiento y aprendizaje ≥2 % cada uno en 5–17 años; 79.8 % nunca recibió rehabilitación | Mide funcionamiento, no TDAH; no desagrega por municipio |

### 2.2 Lo que no existe (búsquedas sin resultado)

- No se encontró ninguna cifra oficial de prevalencia o de atenciones por TDAH publicada por la Secretaría de Salud (salud.gob.hn) ni por el Programa Nacional de Salud Mental. Las noticias de OPS/OMS Honduras (2022–2026) describen fortalecimiento del programa, capacitación mhGAP y evaluación QualityRights en Choluteca, pero no datos epidemiológicos de neurodesarrollo infantil.
- No se encontró un perfil de país de OPS sobre trastornos del neurodesarrollo en Honduras.
- No se encontró ninguna validación psicométrica de la escala Vanderbilt en población hispanohablante de Latinoamérica (sí existe la traducción al español que NICHQ distribuye, sin datos de fiabilidad/validez publicados para la región).
- No se encontró ningún estudio hondureño con cobertura de más de una ciudad ni ninguna serie temporal.
- Las cifras de prensa ("5.29 %", "entre 10 % y 40 % de los niños", "hasta 2 millones de menores") no citan fuente verificable.

Términos buscados: "TDAH niños Honduras prevalencia"; "déficit de atención hiperactividad Revista Médica Hondureña"; "TDAH tesis UNAH escolares Tegucigalpa/Comayagua"; "OPS Honduras salud mental niños neurodesarrollo"; "Vanderbilt Spanish validation Latin America"; "Secretaría de Salud Programa Nacional de Salud Mental".

### 2.3 Conclusión del diagnóstico

Las tres estimaciones locales (5.8 %, 11.73 %, 36 %) varían seis veces entre sí por diferencias de instrumento, muestreo y definición de caso. No hay datos por departamento o municipio, no hay seguimiento en el tiempo y no hay instrumento validado localmente. Cualquier planificación de servicios (psiquiatría infantil, psicopedagogía, capacitación docente) se hace hoy sin base empírica nacional.

## 3. Objetivos

**General.** Generar, con rigor ético y metodológico, la primera base de datos anónima y continua sobre indicadores de riesgo de TDAH en niños de 6–12 años en Honduras, y validar un instrumento de cribado adaptado al contexto local.

**Específicos.**
1. Validar los 18 ítems Atento frente a la escala Vanderbilt (padres) y frente a evaluación clínica estructurada.
2. Estimar propiedades psicométricas (consistencia interna, estructura, sensibilidad, especificidad, puntos de corte) en población hondureña.
3. Establecer la gobernanza de datos y el marco ético del mapa nacional bajo supervisión del CEIB-FCM-UNAH.
4. Producir normas locales orientativas y un informe anual público.
5. Formar estudiantes de posgrado (Psiquiatría, Pediatría) y de pregrado (Psicología) en investigación con instrumentos de cribado.

## 4. Qué aporta Atento

- **Plataforma operativa** (web, móvil-first, gratuita), con cuestionario Vanderbilt 1.ª ed. en español + 18 ítems Atento, puntuación determinista y resultados inmediatos para la familia.
- **Datos anónimos** (municipio, edad en años, sexo, informante, respuestas ítem a ítem, fecha), exportables en formato abierto, con versionado por año.
- **Código abierto** (licencia a definir con el socio; previsiblemente MIT o AGPL), auditable por el comité de ética y por terceros.
- **Infraestructura y mantenimiento** a costo del proponente durante al menos 3 años.
- **Módulo de estudio**: posibilidad de generar códigos de enlace que permitan al equipo clínico vincular una evaluación clínica con el cuestionario web sin que Atento reciba datos identificables (el código lo custodia la UNAH).
- **Mapa y tablero público** con supresión de celdas pequeñas e intervalos de confianza.

## 5. Qué pide Atento a la UNAH

| Solicitud | Unidad propuesta | Rol |
|---|---|---|
| Asesor clínico principal (psiquiatra infantil o pediatra con experiencia en neurodesarrollo) | Departamento de Psiquiatría FCM (contacto publicado: Dra. Xarah Elenne Meza Martínez, xarah.meza@unah.edu.hn, (504) 2239-6607, oficina en Hospital Psiquiátrico Dr. Mario Mendoza; https://fcm.unah.edu.hn/departamentos/psiquiatria/) y/o Departamento de Pediatría FCM (https://fcm.unah.edu.hn/departamentos/pediatria/) | Revisa ítems, textos de resultado, lista de recursos; define protocolo clínico de referencia |
| Asesor psicométrico | Escuela de Ciencias Psicológicas – UGIC (ugic.psicologia@unah.edu.hn; https://psicologia.unah.edu.hn/investigacion/) | Diseño del análisis, estructura factorial, normas |
| Revisión y aprobación ética | Comité de Ética en Investigación Biomédica (CEIB-FCM-UNAH), Edificio Principal FCM, 2.º piso, contiguo a la UIC; ceibunahfcm@gmail.com (boletín CEIB 2021); https://fcm.unah.edu.hn/comite-de-etica-fcm-unah/ | Dictamen del protocolo; supervisión anual |
| Coordinación institucional de investigación | Unidad de Investigación Científica FCM (UIC; https://www.bvs.hn/Honduras/UICFCM/ ; contacto general FCM comunicacion.fcm@unah.edu.hn, 2216-6100 ext. 100043) | Registro del proyecto, convenio, publicación en Rev Med Hond / Rev FCM |
| Estudiantes investigadores | Residentes de Psiquiatría y Pediatría (tesis de posgrado), estudiantes de Psicología (práctica profesional supervisada) | Reclutamiento, aplicación de evaluación de referencia, análisis |
| Coautoría y afiliación | Todas las unidades participantes | Artículo(s), informe anual, normas locales |

Nota: los contactos anteriores provienen de páginas públicas de la UNAH fechadas entre 2016 y 2026; deben confirmarse antes del primer envío. No se localizó una página propia de la UIC ni un responsable actual del CEIB.

Alternativas si la UNAH declina: Universidad Católica de Honduras (UNICAH, Facultad de Ciencias de la Salud y carrera de Psicología) y UNITEC (carrera de Psicología; convenio de investigación con Universidad Isabel I, 2023). No se verificaron unidades de investigación específicas de estas instituciones.

## 6. Diseño del estudio de validación

**Título provisional.** Validación del cuestionario de cribado Atento frente a la escala NICHQ Vanderbilt (padres) y evaluación clínica en niños hondureños de 6–12 años.

**Diseño.** Estudio transversal de validación de prueba diagnóstica (cribado), con muestra enriquecida en dos brazos: (A) niños con diagnóstico clínico de TDAH o en evaluación por sospecha, reclutados en consulta externa (Hospital Mario Mendoza, Hospital Escuela/pediatría, clínicas UNAH); (B) niños de población escolar general, reclutados en escuelas públicas de al menos dos departamentos (uno urbano, uno rural).

**Participantes.** Niños de 6 años 0 meses a 12 años 11 meses; informante madre/padre/cuidador principal que conviva con el niño ≥6 meses; consentimiento del cuidador y asentimiento verbal del niño. Exclusión: discapacidad intelectual conocida, trastorno neurológico mayor, informante que no lea español (a menos que se apoye con lectura asistida, registrada como tal).

**Medidas.**
1. Cuestionario Atento completo (Vanderbilt 1.ª ed. padres + 18 ítems Atento), administrado en el sitio web en presencia de un asistente de investigación.
2. Patrón de referencia: entrevista clínica semiestructurada basada en criterios DSM-5 aplicada por psiquiatra/pediatra cegado al resultado web (o MINI-KID si se obtiene licencia). En el brazo B, aplicar la referencia a todos los positivos y a una submuestra aleatoria de negativos (diseño de verificación parcial, corregido en el análisis).
3. Versión docente de Vanderbilt (1.ª ed., gratuita) en una submuestra para concordancia padre-maestro.
4. Variables de contexto: municipio, zona urbana/rural, escolaridad del cuidador, tiempo para completar.

**Análisis.**
- Consistencia interna: alfa de Cronbach y omega de McDonald para los 18 ítems Atento y para las subescalas Vanderbilt (meta: α ≥ 0.80).
- Correlación ítem-total corregida por ítem (retener ítems con r ≥ 0.30; revisar los que no lo alcancen).
- Estructura: análisis factorial exploratorio (polychoric, brazo B) y confirmatorio (modelo de 2 factores inatención/hiperactividad-impulsividad).
- Validez concurrente: correlación de Spearman entre puntaje Atento y puntajes Vanderbilt; concordancia de clasificación (kappa de Cohen) entre "positivo Atento" y "positivo Vanderbilt".
- Validez de criterio: curva ROC de Atento y de Vanderbilt frente a la referencia clínica; AUC con IC95 %; sensibilidad, especificidad, VPP, VPN y razones de verosimilitud en el corte propuesto; selección del corte óptimo por índice de Youden privilegiando sensibilidad ≥ 0.85 (es un cribado).
- Equidad: funcionamiento diferencial de ítems por sexo y zona urbana/rural; comparación de AUC por sexo.
- Normas locales orientativas: percentiles por sexo y grupo de edad (6–8, 9–12) en el brazo B.

**Tamaño muestral orientativo: ~300 niños (120 brazo A, 180 brazo B).** Justificación: (a) para estimar una sensibilidad esperada de 0.80 con amplitud de IC95 % de ±0.08 se requieren ~96 casos con TDAH confirmado; con 20 % de pérdidas, 120 en el brazo A; (b) para estimar una especificidad esperada de 0.75 con ±0.07 se requieren ~150 no casos, lo que cubre el brazo B con pérdidas; (c) una AUC de 0.80 con ~100 casos y ~150 controles se estima con IC95 % de aproximadamente ±0.05 (Hanley-McNeil); (d) el análisis factorial de 18 ítems supera la regla práctica de 10 observaciones por ítem (180) y se acerca a los 300 recomendados para soluciones estables. Un tamaño de 400–500 permitiría además análisis por subgrupos con potencia adecuada; se propone como segunda fase.

**Fuentes para los valores esperados.** Wolraich ML et al. Psychometric properties of the Vanderbilt ADHD Diagnostic Parent Rating Scale in a referred population. J Pediatr Psychol 2003;28(8):559-568 (α > 0.90; validez concurrente con C-DISC-IV). Bard DE et al. The psychometric properties of the Vanderbilt ADHD Diagnostic Parent Rating Scale in a community population. J Dev Behav Pediatr 2013;34(2):72-82 (sensibilidad ≈ 0.80, especificidad ≈ 0.75 frente a entrevista estructurada; cifras tomadas de fuentes secundarias, confirmar en el artículo). Ambas en población estadounidense; no hay datos latinoamericanos.

## 7. Cronograma orientativo (18 meses)

| Mes | Hito |
|---|---|
| 0–1 | Reunión inicial; carta de intención; designación de asesor clínico y psicométrico |
| 1–3 | Revisión de ítems Atento y textos de la plataforma por el asesor; ajuste; protocolo redactado |
| 3–4 | Envío al CEIB-FCM-UNAH; respuesta a observaciones; permisos de Secretaría de Educación (escuelas) y de los hospitales |
| 4–5 | Capacitación de residentes y estudiantes; piloto con 20 familias; ajuste de logística |
| 5–11 | Reclutamiento y evaluación (brazos A y B) |
| 11–13 | Limpieza y análisis; reunión de resultados |
| 13–15 | Redacción de artículo; ajuste de cortes y textos en la plataforma (versión 2 de datos) |
| 15–18 | Envío a revista; primer informe anual público; normas locales orientativas en el sitio |

## 8. Gobernanza de datos

- **Minimización.** Atento recoge solo: municipio, edad en años, sexo, tipo de informante, respuestas, fecha. Sin nombre, sin IP persistente, sin cuenta de usuario, sin fecha de nacimiento exacta.
- **Separación.** En el estudio, el vínculo entre evaluación clínica y cuestionario web se hace mediante un código aleatorio generado por el equipo UNAH; la tabla de correspondencia código ↔ paciente queda en custodia de la UNAH y nunca llega a Atento.
- **Publicación.** El mapa muestra agregados por municipio y año; se suprimen celdas con n < 5; se muestran intervalos de confianza de Wilson. Los microdatos anónimos se liberan por versión anual (fecha de corte, hash de integridad), previa revisión del CEIB para confirmar que no permiten reidentificación.
- **Acceso.** Microdatos del estudio de validación: solo equipo UNAH-Atento bajo convenio. Microdatos del mapa: públicos en formato abierto tras la revisión indicada.
- **Marco legal.** Honduras no cuenta con una ley general de protección de datos personales vigente; el proyecto adopta voluntariamente los principios de la Declaración de Helsinki, las pautas CIOMS 2016 y el estándar de minimización y supresión descrito, y se somete al CEIB-FCM-UNAH. Se revisará si se aprueba la ley de salud mental o normativa de datos durante el proyecto.
- **Retención.** Datos del estudio: 5 años tras la publicación, luego destrucción de la tabla de correspondencia. Datos del mapa: indefinidos, por ser anónimos y agregables.
- **Propiedad.** Los datos agregados y el código son de dominio público/código abierto; los resultados del estudio son coautoría UNAH–Atento.

## 9. Productos esperados

1. Artículo original en revista indexada (Revista Médica Hondureña o internacional de acceso abierto) con la validación del instrumento Atento.
2. Normas locales orientativas (percentiles por sexo y edad) publicadas en el sitio y en el artículo.
3. Informe anual público "Atento – indicadores de riesgo de TDAH en Honduras", con mapa, serie temporal y limitaciones.
4. Al menos dos tesis de posgrado (Psiquiatría/Pediatría) y trabajos de práctica de Psicología.
5. Conjunto de datos anónimo versionado y documentado (diccionario de variables).
6. Plataforma mejorada (versión 2) con cortes y textos validados localmente.

## 10. Riesgos éticos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Que las familias interpreten el cribado como diagnóstico y etiqueten al niño | Texto de resultado revisado por el asesor clínico; lenguaje de "indicadores" y "conviene consultar"; enlace a recursos; nunca se muestra la palabra "diagnóstico" como resultado |
| Ansiedad o angustia en el cuidador tras un resultado positivo | Mensaje de contención y ruta de referencia; teléfono de orientación del socio si se logra habilitar; evaluación en el piloto de la reacción al texto |
| Falsos negativos que retrasen consulta | Mensaje explícito: "un resultado sin indicadores no descarta nada; si hay preocupación, consulte" |
| Falsos positivos que saturen servicios ya limitados (p. ej., un psiquiatra para 700 pacientes en el Mario Catarino Rivas según prensa 2026) | Corte orientado a sensibilidad pero con mensaje graduado; coordinar con el Programa Nacional de Salud Mental antes de campañas de difusión |
| Reidentificación en municipios pequeños | Supresión n < 5; sin fecha exacta ni edad en meses; revisión del CEIB de cada liberación de datos |
| Sesgo de autoselección que convierta el mapa en "mapa de preocupación" | Advertencia visible en el mapa y en la metodología; separación clara entre brazo poblacional del estudio y datos del mapa |
| Uso de un instrumento con copyright de terceros | Solicitud escrita a NICHQ/AAP (ver `docs/04-correo-nichq.md`); plan B con instrumento alternativo |
| Uso comercial posterior de datos abiertos | Licencia de datos que exige atribución y prohíbe reidentificación (p. ej., ODC-By con cláusula ética); publicación solo de agregados hasta aprobación del CEIB |
| Conflicto de interés del desarrollador | Declaración pública: sin ingresos, sin publicidad, sin vínculos con laboratorios; código y métodos abiertos |
| Participación de menores en el estudio | Consentimiento informado del cuidador, asentimiento del niño, posibilidad de retiro, devolución de resultados clínicos a la familia con orientación |

## 11. Próximo paso

Reunión de 45 minutos con el Departamento de Psiquiatría y la UGIC de Psicología para presentar la plataforma en funcionamiento y acordar el asesor clínico. Atento enviará esta propuesta, el borrador de protocolo y acceso a un entorno de prueba.

---
*Este documento es una propuesta de colaboración; no sustituye el protocolo formal, que se redactará con el asesor designado y se someterá al CEIB-FCM-UNAH.*
