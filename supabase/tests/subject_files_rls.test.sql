-- pgTAP: RLS and integrity for subject_files and the subject-files bucket. Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a5', 'fa@test.atlas', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b5', 'fb@test.atlas', 'authenticated', 'authenticated');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.subject_files'::regclass),
  'RLS is enabled on subject_files'
);
select ok(
  (select not public from storage.buckets where id = 'subject-files'),
  'The subject-files bucket is private'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', true);

insert into subjects (id, name) values ('10000000-0000-0000-0000-0000000000a5', 'Redes');

select lives_ok(
  $$ insert into subject_files (subject_id, storage_path, name, mime_type, size_bytes, text_content)
     values ('10000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a5/10000000-0000-0000-0000-0000000000a5/tcp.pdf',
             'Tema 3 TCP.pdf', 'application/pdf', 1000, 'El protocolo TCP garantiza la entrega ordenada de segmentos.') $$,
  'A can register a file in own subject'
);
select is(
  (select count(*)::int from subject_files where search @@ websearch_to_tsquery('spanish', 'segmento ordenado')),
  1,
  'Spanish full-text search finds the file by stemmed words'
);
select throws_ok(
  $$ insert into subject_files (subject_id, storage_path, name, mime_type, size_bytes)
     values ('10000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000b5/x.pdf', 'x.pdf', 'application/pdf', 10) $$,
  '23514',
  null,
  'The storage path must be in the owner''s folder'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b5","role":"authenticated"}', true);

select is_empty($$ select 1 from subject_files $$, 'B cannot see A''s files');
select throws_ok(
  $$ insert into subject_files (subject_id, storage_path, name, mime_type, size_bytes)
     values ('10000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000b5/y.pdf', 'y.pdf', 'application/pdf', 10) $$,
  '23503',
  null,
  'B cannot attach a file to A''s subject'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values ('subject-files', '00000000-0000-0000-0000-0000000000a5/intruso.pdf', '00000000-0000-0000-0000-0000000000b5') $$,
  '42501',
  null,
  'B cannot upload into A''s storage folder'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', true);
delete from subjects where id = '10000000-0000-0000-0000-0000000000a5';
select is((select count(*)::int from subject_files), 0, 'Deleting the subject removes its file records');

reset role;
set local role anon;
select throws_ok($$ select * from subject_files $$, '42501', null, 'anon has no access to subject_files');

reset role;
select * from finish();
rollback;
