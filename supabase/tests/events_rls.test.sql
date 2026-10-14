-- pgTAP: RLS and constraints on public.events. Runs in a transaction and rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a2', 'ea@test.atlas', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'eb@test.atlas', 'authenticated', 'authenticated');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.events'::regclass),
  'RLS is enabled on events'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);

select lives_ok(
  $$ insert into events (title, event_date, start_time, end_time) values ('Tutoría', '2026-10-20', '10:00', '11:00') $$,
  'A can create a timed event'
);
select lives_ok(
  $$ insert into events (title, event_date) values ('Fiesta local', '2026-10-21') $$,
  'A can create an all-day event'
);
select throws_ok(
  $$ insert into events (title, event_date, start_time, end_time) values ('Al revés', '2026-10-20', '11:00', '10:00') $$,
  '23514',
  null,
  'End time must be after start time'
);
select throws_ok(
  $$ insert into events (title, event_date, end_time) values ('Sin inicio', '2026-10-20', '10:00') $$,
  '23514',
  null,
  'End time requires a start time'
);
select throws_ok(
  $$ insert into events (title, event_date, user_id) values ('Suplantación', '2026-10-20', '00000000-0000-0000-0000-0000000000b2') $$,
  '42501',
  null,
  'A cannot create an event owned by B'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);

select is_empty($$ select 1 from events $$, 'B sees no events of A');

update events set title = 'Hackeado';
delete from events;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);

select is(
  (select count(*)::int from events where title in ('Tutoría', 'Fiesta local')),
  2,
  'B''s update and delete did not touch A''s events'
);

reset role;
set local role anon;
select throws_ok($$ select * from events $$, '42501', null, 'anon has no access to events');

reset role;
select * from finish();
rollback;
