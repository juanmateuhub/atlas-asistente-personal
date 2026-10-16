-- Postgres regexes allow at most 255 repetitions: `{1,1024}` made every Google id fail.
alter table public.events drop constraint events_google_event_id_check;
alter table public.events
  add constraint events_google_event_id_check
  check (google_event_id is null or (google_event_id ~ '^[A-Za-z0-9_-]+$' and char_length(google_event_id) <= 1024));
