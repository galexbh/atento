## Qué cambia

<!-- Una o dos frases. Enlaza el issue si existe: "Cierra #12". -->

## Por qué

<!-- El problema o la necesidad. Si es un texto que ve la familia, explica qué confundía. -->

## Cómo lo probé

- [ ] `pnpm lint` y `pnpm check` en verde
- [ ] `pnpm test` (y `pnpm test:workers` si toqué API, agregados o migraciones)
- [ ] `pnpm test:e2e` si toqué páginas o componentes
- [ ] Probado en móvil (o emulación Pixel 7) y en modo oscuro

## Lista de control

- [ ] No añade datos identificables ni cambia qué se guarda sin actualizar la política de privacidad
- [ ] No presenta Atento como herramienta diagnóstica ni sugiere tratamientos
- [ ] No modifica ítems ni reglas de puntuación de la escala NICHQ Vanderbilt
- [ ] Scripts inline con `nonce={Astro.locals.nonce}`; sin cambios en la CSP (o justificados abajo)
- [ ] Si cambia una versión del instrumento, del consentimiento o de datos publicados, actualiza `CHANGELOG.md`

## Revisión clínica

<!-- Obligatoria si cambia cualquier texto que vea una familia o un docente. -->

- [ ] No aplica (no cambia textos visibles para familias o docentes)
- [ ] Revisado por: <!-- nombre y perfil (pediatría, psicología, psiquiatría infantil) -->
- [ ] Pendiente: etiquetar `pendiente-revision-clinica` y no desplegar a producción

## Capturas (si cambia la interfaz)

<!-- Antes / después, sin datos personales. -->
