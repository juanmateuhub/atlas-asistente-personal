-- pgTAP: RLS on public.jax_actions. Runs in a transaction and rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(7);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a4', 'xa@test.atlas', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b4', 'xb@test.atlas', 'authenticated', 'authenticated');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.jax_actions'::regclass),
  'RLS is enabled on jax_actions'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);

insert into jax_messages (id, role, content) values ('40000000-0000-0000-0000-0000000000a4', 'assistant', 'Te propongo una tarea.');

select lives_ok(
  $$ insert into jax_actions (message_id, kind, payload, summary) values ('40000000-0000-0000-0000-0000000000a4', 'task.create', '{"title":"Estudiar"}', 'Crear tarea «Estudiar»') $$,
  'A can store a proposed action'
);
select throws_ok(
  $$ insert into jax_actions (message_id, kind, payload, summary) values ('40000000-0000-0000-0000-0000000000a4', 'user.drop', '{}', 'x') $$,
  '23514',
  null,
  'Unknown action kinds are rejected'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b4","role":"authenticated"}', true);

select is_empty($$ select 1 from jax_actions $$, 'B cannot see A''s actions');
update jax_actions set status = 'applied';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);

select is((select status from jax_actions), 'pending', 'B cannot confirm A''s actions');
select lives_ok($$ update jax_actions set status = 'dismissed', resolved_at = now() $$, 'A can resolve own actions');

reset role;
set local role anon;
select throws_ok($$ select * from jax_actions $$, '42501', null, 'anon has no access to jax_actions');

reset role;
select * from finish();
rollback;
