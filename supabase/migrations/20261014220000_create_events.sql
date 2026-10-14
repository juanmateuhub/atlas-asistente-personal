-- Calendar events. Single-day events stored as local wall time in Europe/Madrid:
-- event_date (date) + optional start/end time. No start_time = all-day event.
-- Tasks (due_date) and exams (exam_date) are shown in the calendar from their own
-- tables; they are not copied here.

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 150),
  event_date  date not null,
  start_time  time,
  end_time    time,
  location    text check (location is null or char_length(location) <= 150),
  notes       text check (notes is null or char_length(notes) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (end_time is null or (start_time is not null and end_time > start_time))
);

create index events_user_date_idx on public.events (user_id, event_date, start_time);

create trigger events_set_updated_at before update on public.events
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;
revoke all on public.events from anon;

create policy "events_select_own" on public.events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "events_insert_own" on public.events
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "events_update_own" on public.events
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "events_delete_own" on public.events
  for delete to authenticated using ((select auth.uid()) = user_id);
