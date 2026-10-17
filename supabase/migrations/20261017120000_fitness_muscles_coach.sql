-- Fitness: muscle groups per exercise and Jax's coaching notes.
--   exercise_muscles  the user's own mapping of an exercise (by normalised name) to its
--                     muscle groups, primary first. Overrides the app's built-in guess.
--   coach_notes       Jax's analysis of recent training, generated on request.

create table public.exercise_muscles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Lower-case, accent-free, single-spaced exercise name (lib/fitness/muscles.ts).
  exercise_key  text not null check (char_length(exercise_key) between 1 and 60),
  muscles       text[] not null check (
    cardinality(muscles) between 1 and 4
    and muscles <@ array['pecho', 'espalda', 'trapecio', 'hombros', 'biceps', 'triceps', 'antebrazos',
                         'abdomen', 'lumbares', 'gluteos', 'cuadriceps', 'isquios', 'gemelos']::text[]
  ),
  created_at    timestamptz not null default now(),
  unique (user_id, exercise_key)
);

alter table public.exercise_muscles enable row level security;
revoke all on public.exercise_muscles from anon;

create policy "exercise_muscles_select_own" on public.exercise_muscles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "exercise_muscles_insert_own" on public.exercise_muscles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "exercise_muscles_update_own" on public.exercise_muscles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "exercise_muscles_delete_own" on public.exercise_muscles
  for delete to authenticated using ((select auth.uid()) = user_id);

create table public.coach_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  summary     text not null check (char_length(summary) between 1 and 1500),
  tips        jsonb not null default '[]' check (jsonb_typeof(tips) = 'array' and pg_column_size(tips) <= 4000),
  created_at  timestamptz not null default now()
);

create index coach_notes_user_idx on public.coach_notes (user_id, created_at desc);

alter table public.coach_notes enable row level security;
revoke all on public.coach_notes from anon;

create policy "coach_notes_select_own" on public.coach_notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "coach_notes_insert_own" on public.coach_notes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "coach_notes_delete_own" on public.coach_notes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Jax can assign muscle groups to an exercise.
alter table public.jax_actions drop constraint jax_actions_kind_check;
alter table public.jax_actions
  add constraint jax_actions_kind_check
  check (kind ~ '^((task|event|exam|subject|topic|page|reminder|memory|workout|routine|weight|muscle)\.(create|update|delete)|mail\.send)$');
