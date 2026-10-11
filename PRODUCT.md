# Product
<!-- impeccable:product-schema 1 -->

Nota: sin persona disponible para entrevista en esta sesión; los hechos salen de README.md, docs/ y el encargo del agente orquestador. Lo marcado [inferido] es hipótesis a confirmar.

## Platform
web

## Users
Madres, padres y cuidadores en Honduras de niñas y niños de 6 a 12 años, muchas veces desde un teléfono con datos limitados y a veces con baja alfabetización. Secundario: docentes con autorización de la familia. Terciario: personal de salud y socios académicos que leen la metodología y los agregados.

## Product Purpose
Atento es un cuestionario gratuito y anónimo de cribado (no diagnóstico) de TDAH infantil. Ayuda al adulto a ordenar lo que observa y a decidir si vale la pena consultar a un profesional; publica estadísticas agregadas por municipio para dimensionar la necesidad de atención en el país. Éxito: la familia termina los ~10 minutos, entiende su nivel sin asustarse ni confiarse, y sabe qué hacer después.

## Positioning
Escala NICHQ Vanderbilt (1ª ed., español) con puntuación determinista y pública, sin cuenta, sin nombre, sin IP persistente; resultado calculado en el dispositivo; agregados anónimos con supresión < 5 por municipio. Principio rector: cribar no es diagnosticar.

## Operating Context
Flujo: consentimiento → datos (departamento, municipio, edad, sexo, informante) → 72 ítems (54 Vanderbilt + 18 Atento) → resultado con PDF (impresión) y código de vínculo para invitar al docente. Conexiones lentas; uso en casa o escuela; proyecto personal sin fines de lucro, contacto info@galexbh.dev.

## Capabilities and Constraints
Astro 7 + Cloudflare Workers, CSP con nonce (sin handlers inline), sin fuentes externas ni librerías de UI, Turnstile antibots, localStorage para progreso/consentimiento/resultado. Textos legales y de resultado son borradores pendientes de revisión legal/clínica (no cambiar su sentido). Niveles: bajo / moderado / alto; alertas de oposición, conducta, ansiedad/depresión.

## Brand Commitments
Nombre "Atento"; símbolo (A con punto ámbar sobre azul) y logotipo en public/marca; ilustraciones propias en public/ilustraciones; paleta base primario #1F6F8B, acento #F2A541, verde #6BBF8E, coral #E8705F, texto #1E2A32, crema #F7F4EE; tipografía del sistema. Tono: cálido, claro, confiable; nada clínico-frío ni infantilizado. Tuteo/usted neutro hondureño.

## Evidence on Hand
Fotos Pexels en public/img (créditos en docs/08-creditos-imagenes.md), mapa de departamentos (public/ilustraciones/honduras.svg), instrumento en src/data/instrumento. No hay testimonios, cifras de uso ni avales institucionales: no inventarlos. "Mapa nacional" sin datos aún.

## Product Principles
- Nunca diagnóstico; siempre "indicadores" y "consultar a un profesional".
- Pocas cosas por pantalla, frases cortas, botones grandes.
- Anonimato real y explicable en tres frases.
- El resultado se entrega aunque falle el guardado.
- Accesible AA y ligero en datos.

## Accessibility & Inclusion
WCAG 2.1 AA, lang es-HN, toque ≥ 44 px, navegación por teclado, reduced-motion, modo claro y oscuro.
