-- pgTAP: RLS and constraints on public.mail_accounts and public.mail_filters. Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(11);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a7', 'ma@test.atlas', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b7', 'mb@test.atlas', 'authenticated', 'authenticated');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.mail_accounts'::regclass),
  'RLS is enabled on mail_accounts'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.mail_filters'::regclass),
  'RLS is enabled on mail_filters'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}', true);

select lives_ok(
  $$ insert into mail_accounts (email, refresh_token_enc) values ('al1@uji.es', 'enc') $$,
  'A can connect an account'
);
select lives_ok(
  $$ insert into mail_filters (field, pattern) values ('subject', 'Enquestes UJI') $$,
  'A can add a filter'
);
select throws_ok(
  $$ insert into mail_filters (field, pattern) values ('subject', 'enquestes uji') $$,
  '23505',
  null,
  'The same rule cannot be added twice (case-insensitive)'
);
select throws_ok(
  $$ insert into mail_filters (field, pattern) values ('body', 'x y') $$,
  '23514',
  null,
  'Only subject, from and any filters are allowed'
);
select throws_ok(
  $$ insert into mail_filters (field, pattern, user_id) values ('from', 'spam', '00000000-0000-0000-0000-0000000000b7') $$,
  '42501',
  null,
  'A cannot create a filter owned by B'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b7","role":"authenticated"}', true);

select is_empty($$ select 1 from mail_accounts $$, 'B does not see A''s account');
select is_empty($$ select 1 from mail_filters $$, 'B does not see A''s filters');

delete from mail_accounts;
delete from mail_filters;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}', true);

select is(
  (select count(*)::int from mail_accounts) + (select count(*)::int from mail_filters),
  2,
  'B''s deletes did not touch A''s rows'
);

reset role;
set local role anon;
select throws_ok($$ select * from mail_accounts $$, '42501', null, 'anon has no access to mail_accounts');

reset role;
select * from finish();
rollback;
