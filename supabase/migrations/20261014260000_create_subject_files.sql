-- Documents attached to a subject (notes, syllabus, …). The file lives in the
-- private storage bucket "subject-files" under <user_id>/<subject_id>/…; its
-- extracted text lives here so Jax can search it (Spanish full-text index).

create table public.subject_files (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id    uuid not null,
  storage_path  text not null unique check (char_length(storage_path) <= 500),
  name          text not null check (char_length(btrim(name)) between 1 and 200),
  kind          text not null default 'apuntes' check (kind in ('apuntes', 'guia', 'otro')),
  mime_type     text not null check (char_length(mime_type) <= 150),
  size_bytes    integer not null check (size_bytes between 1 and 15728640),
  page_count    integer check (page_count is null or page_count >= 0),
  text_content  text not null default '' check (octet_length(text_content) <= 2097152),
  -- Lets lists show "no text found" without loading the text itself.
  has_text      boolean generated always as (text_content <> '') stored,
  search        tsvector generated always as (
                  setweight(to_tsvector('spanish', coalesce(name, '')), 'A') ||
                  setweight(to_tsvector('spanish', coalesce(text_content, '')), 'B')
                ) stored,
  created_at    timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade,
  -- The storage path must live in the owner's folder.
  check (split_part(storage_path, '/', 1) = user_id::text)
);

create index subject_files_subject_idx on public.subject_files (subject_id, created_at);
create index subject_files_search_idx on public.subject_files using gin (search);

alter table public.subject_files enable row level security;
revoke all on public.subject_files from anon;

create policy "subject_files_select_own" on public.subject_files
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "subject_files_insert_own" on public.subject_files
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "subject_files_update_own" on public.subject_files
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "subject_files_delete_own" on public.subject_files
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Private bucket: 15 MB, only document types we can read.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'subject-files',
  'subject-files',
  false,
  15728640,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ]
)
on conflict (id) do nothing;

-- Each user only touches objects inside their own top-level folder.
create policy "subject_files_storage_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'subject-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "subject_files_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'subject-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "subject_files_storage_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'subject-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
