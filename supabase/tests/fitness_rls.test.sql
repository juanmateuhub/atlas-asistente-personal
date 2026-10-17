-- pgTAP: RLS and checks on workouts, workout_routines and body_weights. Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a9', 'a9@test.atlas', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b9', 'b9@test.atlas', 'authenticated', 'authenticated');

select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.workouts'::regclass, 'public.workout_routines'::regclass, 'public.body_weights'::regclass)),
  'RLS is enabled on every fitness table'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);

select lives_ok(
  $$ insert into workouts (title, workout_date, exercises)
     values ('Pecho', '2026-10-17', '[{"name":"Press banca","sets":[{"reps":8,"weight":60}]}]') $$,
  'A can log a workout'
);
select is(
  (select user_id from workouts where title = 'Pecho'),
  '00000000-0000-0000-0000-0000000000a9'::uuid,
  'The workout belongs to A'
);
select throws_ok(
  $$ insert into workouts (title, workout_date, exercises) values ('Raro', '2026-10-17', '{"a":1}') $$,
  '23514',
  null,
  'exercises must be a JSON array'
);
select throws_ok(
  $$ insert into workouts (title, workout_date, user_id) values ('Suplantación', '2026-10-17', '00000000-0000-0000-0000-0000000000b9') $$,
  '42501',
  null,
  'A cannot log a workout for B'
);
select lives_ok(
  $$ insert into workout_routines (name, exercises) values ('Torso', '[]') $$,
  'A can create a routine'
);
select lives_ok(
  $$ insert into body_weights (measured_on, weight_kg) values ('2026-10-17', 72.4) $$,
  'A can log their weight'
);
select throws_ok(
  $$ insert into body_weights (measured_on, weight_kg) values ('2026-10-17', 72.0) $$,
  '23505',
  null,
  'One weight per day'
);
select throws_ok(
  $$ insert into body_weights (measured_on, weight_kg) values ('2026-10-18', 5) $$,
  '23514',
  null,
  'Weights out of range are rejected'
);
select ok(
  'workout.create' ~ substring((select pg_get_constraintdef(oid) from pg_constraint where conname = 'jax_actions_kind_check') from $re$'(\^.*\$)'$re$),
  'Jax actions accept fitness kinds'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b9","role":"authenticated"}', true);

select is(
  (select count(*)::int from workouts) + (select count(*)::int from workout_routines)
    + (select count(*)::int from body_weights),
  0,
  'B sees none of A''s workouts, routines or weights'
);

update workouts set title = 'Hackeado';
delete from workout_routines;
delete from body_weights;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);

select is(
  (select count(*)::int from workouts where title = 'Pecho') + (select count(*)::int from workout_routines)
    + (select count(*)::int from body_weights),
  3,
  'B''s writes did not touch A''s rows'
);

reset role;
set local role anon;
select throws_ok($$ select * from workouts $$, '42501', null, 'anon has no access to workouts');
select throws_ok($$ select * from body_weights $$, '42501', null, 'anon has no access to body weights');

select * from finish();
rollback;
