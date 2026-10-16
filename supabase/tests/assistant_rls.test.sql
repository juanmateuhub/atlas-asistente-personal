-- pgTAP: RLS and constraints on reminders, push_subscriptions, jax_memories,
-- mail_suggestions and the new events/jax_actions columns. Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(18);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a8', 'ra@test.atlas', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b8', 'rb@test.atlas', 'authenticated', 'authenticated');

-- Suggestions are written by the background scan (secret key), never by users.
insert into mail_suggestions (user_id, gmail_id, mail_subject, mail_from, kind, payload, summary)
values ('00000000-0000-0000-0000-0000000000a8', 'abcdef12', 'Práctica', 'profe@uji.es', 'task', '{"title":"Entregar"}', 'Entregar · vie 23 oct');

select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.reminders'::regclass, 'public.push_subscriptions'::regclass,
                 'public.jax_memories'::regclass, 'public.mail_suggestions'::regclass)),
  'RLS is enabled on the four new tables'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}', true);

select lives_ok(
  $$ insert into reminders (title, remind_at) values ('Llamar', now() + interval '1 hour') $$,
  'A can schedule a reminder'
);
select throws_ok(
  $$ insert into reminders (title, remind_at, user_id) values ('x', now(), '00000000-0000-0000-0000-0000000000b8') $$,
  '42501',
  null,
  'A cannot create a reminder for B'
);
select lives_ok(
  $$ insert into push_subscriptions (endpoint, p256dh, auth) values ('https://push.example/abc', 'p256dh-key-xxxxxxxx', 'auth-key-xxxx') $$,
  'A can register a device'
);
select throws_ok(
  $$ insert into push_subscriptions (endpoint, p256dh, auth) values ('http://insecure.example/x', 'p256dh-key-xxxxxxxx', 'auth-key-xxxx') $$,
  '23514',
  null,
  'Push endpoints must be https'
);
select lives_ok(
  $$ insert into jax_memories (content) values ('Se llama Juan') $$,
  'A can store a memory'
);
select throws_ok(
  $$ insert into jax_memories (content) values ('se llama juan') $$,
  '23505',
  null,
  'The same memory cannot be stored twice (case-insensitive)'
);
select throws_ok(
  $$ insert into mail_suggestions (gmail_id, mail_subject, mail_from, kind, payload, summary)
     values ('abcdef13', 's', 'f', 'task', '{}', 'x') $$,
  '42501',
  null,
  'Users cannot insert mail suggestions'
);
select is(
  (select count(*)::int from mail_suggestions),
  1,
  'A sees their own suggestion'
);
select lives_ok(
  $$ update mail_suggestions set status = 'accepted' $$,
  'A can accept their suggestion'
);
select throws_ok(
  $$ update mail_suggestions set status = 'maybe' $$,
  '23514',
  null,
  'Suggestion status is constrained'
);
select lives_ok(
  $$ insert into events (title, event_date, google_event_id) values ('Tutoría', '2026-10-20', 'abc123_20261020') $$,
  'Events accept a Google id'
);
select throws_ok(
  $$ insert into events (title, event_date, google_event_id) values ('Copia', '2026-10-21', 'abc123_20261020') $$,
  '23505',
  null,
  'A Google event is linked to one Atlas event per user'
);
select throws_ok(
  $$ insert into events (title, event_date, google_event_id) values ('Rara', '2026-10-21', 'bad id!') $$,
  '23514',
  null,
  'Google ids are validated'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b8","role":"authenticated"}', true);

select is(
  (select count(*)::int from reminders) + (select count(*)::int from push_subscriptions)
    + (select count(*)::int from jax_memories) + (select count(*)::int from mail_suggestions),
  0,
  'B sees none of A''s reminders, devices, memories or suggestions'
);

delete from reminders;
delete from jax_memories;
update mail_suggestions set status = 'dismissed';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}', true);

select is(
  (select count(*)::int from reminders) + (select count(*)::int from jax_memories)
    + (select count(*)::int from mail_suggestions where status = 'accepted'),
  3,
  'B''s writes did not touch A''s rows'
);

reset role;
set local role anon;
select throws_ok($$ select * from reminders $$, '42501', null, 'anon has no access to reminders');

reset role;
select ok(
  not has_function_privilege('authenticated', 'private.call_atlas(text)', 'execute'),
  'Signed-in users cannot trigger the cron caller'
);

select * from finish();
rollback;
