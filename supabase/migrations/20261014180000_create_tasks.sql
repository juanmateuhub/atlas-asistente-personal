-- Tasks: one row per user task. Ownership is enforced by RLS (user_id = auth.uid()).

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  notes        text check (notes is null or char_length(notes) <= 2000),
  priority     text not null default 'media' check (priority in ('baja', 'media', 'alta')),
  status       text not null default 'pendiente' check (status in ('pendiente', 'en_curso', 'hecha')),
  due_date     date,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.tasks is 'Atlas: tareas personales. Solo visibles para su propietario (RLS).';

-- Main list query: a user's tasks filtered by status, ordered by due date.
create index tasks_user_status_due_idx on public.tasks (user_id, status, due_date);

-- Keep updated_at / completed_at consistent regardless of what the client sends.
create function public.tasks_set_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status = 'hecha' and (tg_op = 'INSERT' or old.status is distinct from 'hecha') then
    new.completed_at := now();
  elsif new.status <> 'hecha' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_set_timestamps
before insert or update on public.tasks
for each row execute function public.tasks_set_timestamps();

-- Row Level Security: each user only sees and changes their own tasks.
alter table public.tasks enable row level security;

revoke all on public.tasks from anon;

create policy "tasks_select_own" on public.tasks
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "tasks_insert_own" on public.tasks
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "tasks_update_own" on public.tasks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "tasks_delete_own" on public.tasks
  for delete to authenticated
  using ((select auth.uid()) = user_id);
