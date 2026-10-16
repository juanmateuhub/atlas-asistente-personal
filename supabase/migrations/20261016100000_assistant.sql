-- Atlas as a proactive assistant:
--   reminders            one-off reminders at a date and time, delivered as push notifications
--   push_subscriptions   Web Push endpoints of the user's devices
--   jax_memories         durable facts Jax keeps about the user (long-term memory)
--   mail_suggestions     tasks/events Jax found by reading new mail on its own; the user accepts or dismisses them
--   events.google_*      two-way sync with the user's Google Calendar (the same Google account as the mail)
-- Background work (due reminders, mail scan, calendar pull) runs from pg_cron, which
-- calls the app's /api/cron/* routes with a shared secret kept in Supabase Vault.

-- Reminders -----------------------------------------------------------------------

create table public.reminders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  remind_at   timestamptz not null,
  -- Set when the notification goes out (or is claimed by the sender).
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index reminders_user_idx on public.reminders (user_id, remind_at);
create index reminders_due_idx on public.reminders (remind_at) where sent_at is null;

alter table public.reminders enable row level security;
revoke all on public.reminders from anon;

create policy "reminders_select_own" on public.reminders
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "reminders_insert_own" on public.reminders
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "reminders_update_own" on public.reminders
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "reminders_delete_own" on public.reminders
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Push subscriptions --------------------------------------------------------------

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint    text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh      text not null check (char_length(p256dh) between 10 and 200),
  auth        text not null check (char_length(auth) between 10 and 100),
  created_at  timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;

create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Long-term memory ----------------------------------------------------------------

create table public.jax_memories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content     text not null check (char_length(btrim(content)) between 2 and 300),
  created_at  timestamptz not null default now()
);

create unique index jax_memories_user_content_idx on public.jax_memories (user_id, lower(content));

alter table public.jax_memories enable row level security;
revoke all on public.jax_memories from anon;

create policy "jax_memories_select_own" on public.jax_memories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "jax_memories_insert_own" on public.jax_memories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "jax_memories_delete_own" on public.jax_memories
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Mail suggestions ----------------------------------------------------------------
-- Written only by the background scan (secret key, bypasses RLS): users can read them
-- and change their status, never insert.

create table public.mail_suggestions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  gmail_id      text not null check (gmail_id ~ '^[0-9a-f]{8,32}$'),
  mail_subject  text not null check (char_length(mail_subject) <= 300),
  mail_from     text not null check (char_length(mail_from) <= 320),
  kind          text not null check (kind in ('task', 'event')),
  -- Validated column values for tasks/events (same parsers as the forms).
  payload       jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 8000),
  summary       text not null check (char_length(summary) between 1 and 500),
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  unique (user_id, gmail_id, kind)
);

create index mail_suggestions_user_idx on public.mail_suggestions (user_id, status, created_at);

alter table public.mail_suggestions enable row level security;
revoke all on public.mail_suggestions from anon;

create policy "mail_suggestions_select_own" on public.mail_suggestions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "mail_suggestions_update_own" on public.mail_suggestions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- The connected Google account: granted scopes and background-work bookmarks.
alter table public.mail_accounts
  add column scopes text not null default '' check (char_length(scopes) <= 2000),
  add column scanned_at timestamptz,
  add column calendar_synced_at timestamptz;

-- Google Calendar sync ------------------------------------------------------------
-- google_event_id: the event's id in the user's primary Google calendar.
-- google_updated_at: Google's `updated` the last time both sides agreed.

alter table public.events
  add column google_event_id text check (google_event_id is null or google_event_id ~ '^[A-Za-z0-9_-]{1,1024}$'), -- fixed in 20261016110000
  add column google_updated_at timestamptz,
  add constraint events_user_google_key unique (user_id, google_event_id);

-- Jax actions: reminders, memories and sending mail ---------------------------------

alter table public.jax_actions drop constraint jax_actions_kind_check;
alter table public.jax_actions
  add constraint jax_actions_kind_check
  check (kind ~ '^((task|event|exam|subject|topic|page|reminder|memory)\.(create|update|delete)|mail\.send)$');

-- Scheduler -----------------------------------------------------------------------
-- The app URL and the shared secret live in Vault (never in a migration):
--   select vault.create_secret('https://<app>', 'atlas_app_url');
--   select vault.create_secret('<CRON_SECRET>', 'atlas_cron_secret');
-- Without them the jobs do nothing.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.call_atlas(path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  secret text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'atlas_app_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'atlas_cron_secret';
  if base is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(base, '/') || path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function private.call_atlas(text) from public, anon, authenticated;

-- Due reminders, every minute.
select cron.schedule('atlas-recordatorios', '* * * * *', $$ select private.call_atlas('/api/cron/recordatorios') $$);
-- New mail and Google Calendar changes, every 15 minutes.
select cron.schedule('atlas-google', '*/15 * * * *', $$ select private.call_atlas('/api/cron/google') $$);
