Para cualquier trabajo de interfaz o diseño web, usa la skill apple-ui-skills.

## Diseño de Atlas

- `apple-ui-skills` define la base visual (tokens en `app/globals.css`): fondo blanco, Inter, acento `#155BD0`, radio 21px. Manda sobre cualquier otra sugerencia estética.
- El plugin `frontend-design` se usa para criterio y pulido (jerarquía, textos, evitar aspecto genérico), no para cambiar la estética.
- Animaciones: el usuario las quiere en toda la app, pero cada una responde a una acción (pulsar, completar, abrir, añadir, borrar) más una entrada suave por página (`app/(app)/template.tsx`). Solo `transform`/`opacity`, ≤200ms, ease-out, respetando `prefers-reduced-motion`. Usar la utilidad `pressable` y `motion/react` (`AnimatePresence`, `layoutId`).
- Revisar la UI con capturas reales antes de darla por buena.
