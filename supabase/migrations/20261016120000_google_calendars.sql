-- Events from every Google calendar the user shows (e.g. the UJI timetable "Les teues classes"),
-- not only the primary one.
--   google_calendar       Google calendar id; 'primary' for Atlas events and the user's own calendar
--   google_calendar_name  its name, shown in Atlas; null for the primary calendar
-- Events from other calendars are read-only in Atlas (the app only edits rows in 'primary').

alter table public.events
  add column google_calendar text not null default 'primary' check (char_length(google_calendar) between 1 and 300),
  add column google_calendar_name text check (google_calendar_name is null or char_length(google_calendar_name) <= 150);

-- The same event id can exist in two calendars.
alter table public.events drop constraint events_user_google_key;
alter table public.events
  add constraint events_user_google_key unique (user_id, google_calendar, google_event_id);
