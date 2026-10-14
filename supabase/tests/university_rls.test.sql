-- pgTAP: RLS and cross-user integrity for subjects/topics/pages/exams.
-- Runs in a transaction and rolls back; no data persists.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(16);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a1', 'ua@test.atlas', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'ub@test.atlas', 'authenticated', 'authenticated');

select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.subjects'::regclass, 'public.topics'::regclass,
                 'public.pages'::regclass, 'public.exams'::regclass)),
  'RLS is enabled on all university tables'
);

-- User A builds a subject -> topic -> page, and an exam.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select lives_ok(
  $$ insert into subjects (id, name) values ('10000000-0000-0000-0000-0000000000a1', 'Redes') $$,
  'A can create a subject'
);
select lives_ok(
  $$ insert into topics (id, subject_id, title) values ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1', 'Tema 1') $$,
  'A can create a topic in own subject'
);
select lives_ok(
  $$ insert into pages (id, topic_id, title) values ('30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', 'Apuntes') $$,
  'A can create a page in own topic'
);
select lives_ok(
  $$ insert into exams (subject_id, title, exam_date) values ('10000000-0000-0000-0000-0000000000a1', 'Parcial', '2026-11-20') $$,
  'A can create an exam in own subject'
);
select throws_ok(
  $$ update pages set content = '{"type":"paragraph"}' where id = '30000000-0000-0000-0000-0000000000a1' $$,
  '23514',
  null,
  'Page content must be a doc node'
);
select throws_ok(
  $$ insert into exams (subject_id, title, exam_date, grade) values ('10000000-0000-0000-0000-0000000000a1', 'Final', '2027-01-20', 11) $$,
  '23514',
  null,
  'Grades must be between 0 and 10'
);

-- User B.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

select is_empty($$ select 1 from subjects $$, 'B sees no subjects of A');
select is_empty($$ select 1 from topics $$, 'B sees no topics of A');
select is_empty($$ select 1 from pages $$, 'B sees no pages of A');
select is_empty($$ select 1 from exams $$, 'B sees no exams of A');

select throws_ok(
  $$ insert into topics (subject_id, title) values ('10000000-0000-0000-0000-0000000000a1', 'Intrusión') $$,
  '23503',
  null,
  'B cannot attach a topic to A''s subject'
);
select throws_ok(
  $$ insert into exams (subject_id, title, exam_date) values ('10000000-0000-0000-0000-0000000000a1', 'Intrusión', '2026-12-01') $$,
  '23503',
  null,
  'B cannot attach an exam to A''s subject'
);

update pages set title = 'Hackeada' where id = '30000000-0000-0000-0000-0000000000a1';
delete from subjects where id = '10000000-0000-0000-0000-0000000000a1';

-- Back to A: nothing changed; deleting the subject cascades.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select is(
  (select title from pages where id = '30000000-0000-0000-0000-0000000000a1'),
  'Apuntes',
  'B''s update and delete did not touch A''s data'
);
select lives_ok(
  $$ delete from subjects where id = '10000000-0000-0000-0000-0000000000a1' $$,
  'A can delete own subject'
);
select is(
  (select count(*)::int from pages) + (select count(*)::int from topics) + (select count(*)::int from exams),
  0,
  'Deleting a subject removes its topics, pages and exams'
);

reset role;
select * from finish();
rollback;
