-- Jax: one rolling conversation per user. Messages are kept for 7 days (the app
-- filters and prunes older rows); there is no durable personal memory.
-- Only final assistant answers are stored (streamed drafts are never persisted).

create table public.jax_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Monotonic order, independent of clock ties.
  position    bigint generated always as identity,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null check (char_length(content) between 1 and 20000),
  -- Citations validated server-side: [{ "ref": "n1", "pageId": uuid, "subjectId": uuid, "title": text }]
  citations   jsonb not null default '[]'::jsonb check (jsonb_typeof(citations) = 'array'),
  created_at  timestamptz not null default now()
);

create index jax_messages_user_idx on public.jax_messages (user_id, position);
create index jax_messages_created_idx on public.jax_messages (user_id, created_at);

alter table public.jax_messages enable row level security;
revoke all on public.jax_messages from anon;

create policy "jax_messages_select_own" on public.jax_messages
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "jax_messages_insert_own" on public.jax_messages
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "jax_messages_delete_own" on public.jax_messages
  for delete to authenticated using ((select auth.uid()) = user_id);
-- No update policy: messages are immutable.
