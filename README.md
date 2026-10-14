# Atlas

Aplicación web personal modular: tareas, universidad (asignaturas, temas y apuntes), inicio con resumen diario y, más adelante, calendario, fitness y el asistente **Jax**.

## Stack

- Next.js 16 (App Router, Cache Components) · React 19 · TypeScript estricto
- Tailwind CSS 4 · lucide-react
- Diseño: skill `apple-ui-skills` (tokens en `app/globals.css`)
- Previsto: Supabase (Auth + PostgreSQL con RLS), Vercel, Gemini (Jax)

## Comandos

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run lint
npm run build
```

## Estructura

```
app/
  layout.tsx          # raíz: fuente Inter, metadatos
  globals.css         # tokens de diseño, animaciones, estilos de apuntes
  (auth)/             # login, registro
  (app)/              # shell autenticado
    page.tsx          # Inicio
    tareas/
    calendario/       # mes + agenda del día
    universidad/      # asignaturas > temas > páginas, exámenes
components/           # shell, ui, tasks, university, home
lib/                  # dominio: auth, tasks, university, home, supabase
supabase/             # migraciones y tests pgTAP
tests/                # Vitest
```

## Base de datos

Migraciones en `supabase/migrations/`, tests pgTAP (RLS) en `supabase/tests/`.

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --linked --dry-run   # revisar antes de aplicar
npx supabase db push --linked
npm run test:db                           # pgTAP contra el proyecto enlazado, sin Docker
```

`npm run test:db` ejecuta cada test en una transacción que se aborta al final: no deja datos.

## Estado

- Fase 2 (identidad): login, registro con confirmación por correo, cierre de sesión y rutas protegidas por `proxy.ts`.
- Fase 3 (tareas): crear, editar, completar, borrar y filtrar; tabla `tasks` con RLS probada.
- Fase 4 (universidad): asignaturas, temas, apuntes con editor y guardado automático, exámenes.
- Fase 5 (calendario): vista de mes con eventos propios, fechas límite de tareas y exámenes.
- Fase 8 (inicio): resumen del día derivado de tareas, exámenes y apuntes recientes.

Primera versión (MVP) completa. Siguiente: fitness y el asistente Jax.

Variables: copia `.env.example` a `.env.local`. Tests: `npm test` y `npm run test:db`.
