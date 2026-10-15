-- University mail (Gmail, read-only). One connected account per user.
-- The Google refresh token is stored encrypted by the app (AES-256-GCM with
-- MAIL_TOKEN_KEY); the database never sees it in clear text.

create table public.mail_accounts (
  user_id            uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  email              text not null check (char_length(email) between 3 and 320),
  refresh_token_enc  text not null,
  connected_at       timestamptz not null default now()
);

alter table public.mail_accounts enable row level security;
revoke all on public.mail_accounts from anon;

create policy "mail_accounts_select_own" on public.mail_accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "mail_accounts_insert_own" on public.mail_accounts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "mail_accounts_update_own" on public.mail_accounts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "mail_accounts_delete_own" on public.mail_accounts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Junk filters: a message is hidden in Atlas (never deleted in Gmail) when the
-- chosen field (subject, sender, or either: 'any') contains the pattern (case- and accent-insensitive, done in the app).
create table public.mail_filters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  field       text not null check (field in ('subject', 'from', 'any')),
  pattern     text not null check (char_length(btrim(pattern)) between 2 and 120),
  created_at  timestamptz not null default now()
);

create unique index mail_filters_user_rule_idx on public.mail_filters (user_id, field, lower(pattern));

alter table public.mail_filters enable row level security;
revoke all on public.mail_filters from anon;

create policy "mail_filters_select_own" on public.mail_filters
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "mail_filters_insert_own" on public.mail_filters
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "mail_filters_delete_own" on public.mail_filters
  for delete to authenticated using ((select auth.uid()) = user_id);
