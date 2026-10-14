-- University: subjects -> topics -> pages (rich-text notes), plus exams per subject.
-- Ownership: every row has user_id = auth.uid() (RLS). Composite foreign keys
-- (parent_id, user_id) make it impossible to attach a row to another user's parent.

-- Shared trigger: keep updated_at current.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Subjects -------------------------------------------------------------------
create table public.subjects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 100),
  description text check (description is null or char_length(description) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);
create index subjects_user_idx on public.subjects (user_id, name);

-- Topics ---------------------------------------------------------------------
create table public.topics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id  uuid not null,
  title       text not null check (char_length(btrim(title)) between 1 and 150),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade
);
create index topics_subject_idx on public.topics (subject_id, position);

-- Pages (notes) --------------------------------------------------------------
-- content is a Tiptap/ProseMirror JSON document; never raw HTML.
-- version supports optimistic concurrency for autosave.
create table public.pages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic_id    uuid not null,
  title       text not null check (char_length(btrim(title)) between 1 and 150),
  content     jsonb not null default '{"type":"doc","content":[]}'::jsonb
              check (jsonb_typeof(content) = 'object' and content ->> 'type' = 'doc'
                     and pg_column_size(content) <= 512000),
  version     integer not null default 1,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete cascade
);
create index pages_topic_idx on public.pages (topic_id, position);

-- Exams ----------------------------------------------------------------------
create table public.exams (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id  uuid not null,
  title       text not null check (char_length(btrim(title)) between 1 and 150),
  exam_date   date not null,
  exam_time   time,
  location    text check (location is null or char_length(location) <= 150),
  grade       numeric(4, 2) check (grade is null or grade between 0 and 10),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade
);
create index exams_user_date_idx on public.exams (user_id, exam_date);
create index exams_subject_idx on public.exams (subject_id, exam_date);

-- Triggers -------------------------------------------------------------------
create trigger subjects_set_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();
create trigger topics_set_updated_at before update on public.topics
  for each row execute function public.set_updated_at();
create trigger pages_set_updated_at before update on public.pages
  for each row execute function public.set_updated_at();
create trigger exams_set_updated_at before update on public.exams
  for each row execute function public.set_updated_at();

-- RLS ------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['subjects', 'topics', 'pages', 'exams'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      t || '_delete_own', t);
  end loop;
end;
$$;
