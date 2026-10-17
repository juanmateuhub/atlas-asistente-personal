-- Fitness: workouts, routines (workout templates) and body weight.
--   workouts          one row per training session; exercises is the full log as JSON
--   workout_routines  reusable templates; a workout started from one copies its exercises
--   body_weights      at most one weight per day
--
-- exercises (both tables): [{ "name": "Press banca", "sets": [{ "reps": 8, "weight": 60 }] }]
-- weight in kg, null for bodyweight. The app validates the shape (lib/fitness/validation.ts);
-- the checks here bound type and size. Ownership is enforced by RLS (user_id = auth.uid()).

create function public.fitness_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Workouts ------------------------------------------------------------------------

create table public.workouts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 1 and 80),
  workout_date  date not null,
  notes         text check (notes is null or char_length(notes) <= 2000),
  exercises     jsonb not null default '[]' check (jsonb_typeof(exercises) = 'array' and pg_column_size(exercises) <= 40000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.workouts is 'Atlas: entrenos. Solo visibles para su propietario (RLS).';

create index workouts_user_date_idx on public.workouts (user_id, workout_date desc);

create trigger workouts_set_updated_at
before update on public.workouts
for each row execute function public.fitness_set_updated_at();

alter table public.workouts enable row level security;
revoke all on public.workouts from anon;

create policy "workouts_select_own" on public.workouts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "workouts_insert_own" on public.workouts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "workouts_update_own" on public.workouts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "workouts_delete_own" on public.workouts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Routines ------------------------------------------------------------------------

create table public.workout_routines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  notes       text check (notes is null or char_length(notes) <= 2000),
  exercises   jsonb not null default '[]' check (jsonb_typeof(exercises) = 'array' and pg_column_size(exercises) <= 40000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.workout_routines is 'Atlas: rutinas de entreno. Solo visibles para su propietario (RLS).';

create index workout_routines_user_idx on public.workout_routines (user_id, name);

create trigger workout_routines_set_updated_at
before update on public.workout_routines
for each row execute function public.fitness_set_updated_at();

alter table public.workout_routines enable row level security;
revoke all on public.workout_routines from anon;

create policy "workout_routines_select_own" on public.workout_routines
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "workout_routines_insert_own" on public.workout_routines
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "workout_routines_update_own" on public.workout_routines
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "workout_routines_delete_own" on public.workout_routines
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Body weight ---------------------------------------------------------------------

create table public.body_weights (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on  date not null,
  weight_kg    numeric(5, 2) not null check (weight_kg between 20 and 400),
  created_at   timestamptz not null default now(),
  unique (user_id, measured_on)
);

comment on table public.body_weights is 'Atlas: peso corporal, uno por día. Solo visible para su propietario (RLS).';

alter table public.body_weights enable row level security;
revoke all on public.body_weights from anon;

create policy "body_weights_select_own" on public.body_weights
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "body_weights_insert_own" on public.body_weights
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "body_weights_update_own" on public.body_weights
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "body_weights_delete_own" on public.body_weights
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Jax actions: workouts, routines and weights -------------------------------------

alter table public.jax_actions drop constraint jax_actions_kind_check;
alter table public.jax_actions
  add constraint jax_actions_kind_check
  check (kind ~ '^((task|event|exam|subject|topic|page|reminder|memory|workout|routine|weight)\.(create|update|delete)|mail\.send)$');
