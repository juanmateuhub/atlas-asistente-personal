-- pgTAP: RLS and checks on exercise_muscles and coach_notes. Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000000ac', 'ac@test.atlas', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000bc', 'bc@test.atlas', 'authenticated', 'authenticated');

select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.exercise_muscles'::regclass, 'public.coach_notes'::regclass)),
  'RLS is enabled on exercise_muscles and coach_notes'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ac","role":"authenticated"}', true);

select lives_ok(
  $$ insert into exercise_muscles (exercise_key, muscles) values ('cc', array['biceps', 'antebrazos']) $$,
  'A can map an exercise to muscles'
);
select throws_ok(
  $$ insert into exercise_muscles (exercise_key, muscles) values ('x', array['alas']) $$,
  '23514',
  null,
  'Unknown muscle groups are rejected'
);
select throws_ok(
  $$ insert into exercise_muscles (exercise_key, muscles) values ('cc', array['pecho']) $$,
  '23505',
  null,
  'One mapping per exercise'
);
select lives_ok(
  $$ insert into coach_notes (summary, tips) values ('Buena semana', '["Sube peso"]') $$,
  'A can store a coach note'
);
select ok(
  'muscle.update' ~ substring((select pg_get_constraintdef(oid) from pg_constraint where conname = 'jax_actions_kind_check') from $re$'(\^.*\$)'$re$),
  'Jax actions accept muscle kinds'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000bc","role":"authenticated"}', true);

select is(
  (select count(*)::int from exercise_muscles) + (select count(*)::int from coach_notes),
  0,
  'B sees none of A''s mappings or notes'
);

reset role;
set local role anon;
select throws_ok($$ select * from exercise_muscles $$, '42501', null, 'anon has no access to exercise_muscles');
select throws_ok($$ select * from coach_notes $$, '42501', null, 'anon has no access to coach_notes');

select * from finish();
rollback;
