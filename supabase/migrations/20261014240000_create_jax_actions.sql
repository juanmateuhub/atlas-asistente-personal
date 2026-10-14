-- Changes Jax proposes (create/update/delete tasks, events, exams…). Nothing is
-- applied until the user confirms. The payload is validated when proposed and
-- again when applied; the target tables' RLS still decides what can be touched.

create table public.jax_actions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  message_id  uuid not null references public.jax_messages (id) on delete cascade,
  kind        text not null check (kind ~ '^(task|event|exam|subject|topic|page)\.(create|update|delete)$'),
  payload     jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 200000),
  summary     text not null check (char_length(summary) between 1 and 500),
  status      text not null default 'pending' check (status in ('pending', 'applied', 'dismissed', 'failed')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index jax_actions_message_idx on public.jax_actions (message_id);
create index jax_actions_user_idx on public.jax_actions (user_id, created_at);

alter table public.jax_actions enable row level security;
revoke all on public.jax_actions from anon;

create policy "jax_actions_select_own" on public.jax_actions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "jax_actions_insert_own" on public.jax_actions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "jax_actions_update_own" on public.jax_actions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
-- No delete policy: actions disappear with their message (cascade).
