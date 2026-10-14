-- pgTAP: RLS on public.tasks. Runs in a transaction and rolls back; no data persists.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(13);

-- Two throwaway users (rolled back at the end).
insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.atlas', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.atlas', 'authenticated', 'authenticated');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.tasks'::regclass),
  'RLS is enabled on tasks'
);

-- Act as user A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$ insert into tasks (title) values ('Tarea de A') $$,
  'A can create a task; user_id defaults to auth.uid()'
);
select is(
  (select user_id from tasks where title = 'Tarea de A'),
  '00000000-0000-0000-0000-00000000000a'::uuid,
  'New task belongs to A'
);
select throws_ok(
  $$ insert into tasks (title, user_id) values ('Suplantación', '00000000-0000-0000-0000-00000000000b') $$,
  '42501',
  null,
  'A cannot create a task owned by B'
);
select throws_ok(
  $$ insert into tasks (title) values ('   ') $$,
  '23514',
  null,
  'Blank titles are rejected'
);
select lives_ok(
  $$ update tasks set status = 'hecha' where title = 'Tarea de A' $$,
  'A can complete own task'
);
select isnt(
  (select completed_at from tasks where title = 'Tarea de A'),
  null,
  'completed_at is set by the trigger'
);

-- Act as user B: cannot see, update or delete A's task.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is_empty(
  $$ select 1 from tasks where title = 'Tarea de A' $$,
  'B cannot see A''s task'
);

update tasks set title = 'Hackeada' where title = 'Tarea de A';
delete from tasks where title = 'Tarea de A';

-- Back to A.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is(
  (select count(*)::int from tasks where title = 'Tarea de A'),
  1,
  'B''s update and delete did not touch A''s task'
);
select throws_ok(
  $$ update tasks set user_id = '00000000-0000-0000-0000-00000000000b' where title = 'Tarea de A' $$,
  '42501',
  null,
  'A cannot transfer a task to B'
);
select lives_ok(
  $$ update tasks set status = 'pendiente' where title = 'Tarea de A' $$,
  'A can reopen own task'
);
select is(
  (select completed_at from tasks where title = 'Tarea de A'),
  null,
  'Reopening clears completed_at'
);

-- Anonymous visitors get nothing.
reset role;
set local role anon;
select throws_ok(
  $$ select * from tasks $$,
  '42501',
  null,
  'anon has no access to tasks'
);

reset role;
select * from finish();
rollback;
