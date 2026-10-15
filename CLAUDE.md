## Diseño de Atlas

- Identidad **Señal** (rama `identidad-nueva`): fondo papel `#F4F4F2`, tinta `#0E0E0E` y un único acento amarillo señal `#FFD000`. Titulares en Bricolage Grotesque, texto en Geist. Tokens en `app/globals.css`; maqueta de referencia `mockup-senal.png` (paleta) y `mockup-plana.png` (tipografía).
- Reglas (skills `redesign-existing-projects` y `design-taste-frontend`): superficies separadas por tono (blanco sobre papel, `bg-step` para chips), sin líneas finas, sin sombras en reposo (solo lo que flota: diálogos, panel de Jax, aviso), sin degradados, sin brillos, sin cristal. Botones redondos; el principal amarillo con texto negro. El amarillo nunca como texto: usar `text-accent-ink`.
- Rampas `neutral-*` y `accent-*` son de énfasis: 100 = máximo contraste con el fondo, 900 = más tenue.
- Logo (dentro de la app y favicon): "A" blanca sobre baldosa negra con un círculo amarillo en el vértice (`components/brand/atlas-logo.tsx`, `app/icon.svg`). Icono de la pantalla de inicio del móvil: Jax sobre amarillo (`app/apple-icon.png`, `public/icons/jax-icon-*.png`).
- Microinteracciones: chispas y sonido al completar (`components/tasks/task-check.tsx`, `lib/ui/sound.ts`), salida deslizante de filas, aviso con Deshacer (`components/ui/toast.tsx`), indicadores deslizantes.
- Iconos: `@phosphor-icons/react`. Revisar la UI con capturas reales antes de darla por buena; `web-design-guidelines` para auditar accesibilidad.
