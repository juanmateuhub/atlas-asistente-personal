## Diseño de Atlas

- Base visual: el rediseño **Nocturne** (carpeta `Atlas rediseño Nocturno/`, maqueta `Atlas v2.dc.html`). Colores, rampas, radios, sombras y curvas en `app/globals.css` (copiados de `_ds/…/styles.css`).
- Al migrar una pantalla, replicar la maqueta exactamente (tamaños, espaciados, radios, sombras, cubic-bezier) sin cambiar la lógica de datos. Iconos: `@phosphor-icons/react`. Fuente: Inter.
- Microinteracciones: chispas y sonido al completar (`components/tasks/task-check.tsx`, `lib/ui/sound.ts`), salida deslizante de filas, aviso con Deshacer (`components/ui/toast.tsx`), indicadores deslizantes, brillo que sigue al ratón y cielo con estrellas de noche (`components/shell/ambient.tsx`).
- Los tokens antiguos (`ink`, `body`, `muted`, `line`, `raised`, `sky`) son alias temporales para pantallas aún sin migrar.
- El plugin `frontend-design` se usa para criterio y pulido, no para cambiar la estética.
- Revisar la UI con capturas reales antes de darla por buena.
