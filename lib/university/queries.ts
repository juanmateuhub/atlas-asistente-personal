import "server-only";
import { getCurrentUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import type { FileKind, SubjectFile } from "./files";
import { parseDoc } from "./validation";
import {
  EMPTY_DOC,
  type Exam,
  type ExamSummary,
  type NotePage,
  type Subject,
  type SubjectSummary,
  type Topic,
} from "./types";

// Every getter resolves the session first; RLS still restricts rows to the owner.

type ExamRow = {
  id: string;
  subject_id: string;
  title: string;
  exam_date: string;
  exam_time: string | null;
  location: string | null;
  grade: number | string | null;
};

const EXAM_COLUMNS = "id,subject_id,title,exam_date,exam_time,location,grade";

function toExam(row: ExamRow): Exam {
  return {
    id: row.id,
    subjectId: row.subject_id,
    title: row.title,
    date: row.exam_date,
    time: row.exam_time ? row.exam_time.slice(0, 5) : null,
    location: row.location,
    grade: row.grade === null ? null : Number(row.grade),
  };
}

/** Exams from `today` on, soonest first, with their subject name. */
export async function listUpcomingExams(today: string, limit = 20): Promise<ExamSummary[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exams")
    .select(`${EXAM_COLUMNS},subjects(name)`)
    .gte("exam_date", today)
    .order("exam_date")
    .order("exam_time", { nullsFirst: false })
    .limit(limit);
  if (error) throw new Error("No se han podido cargar los exámenes.");

  return data.map((row) => ({
    ...toExam(row),
    subjectName: (row.subjects as unknown as { name: string } | null)?.name ?? "",
  }));
}

export async function listSubjects(today: string): Promise<SubjectSummary[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const [{ data, error }, exams] = await Promise.all([
    supabase.from("subjects").select("id,name,description,topics(count)").order("name"),
    listUpcomingExams(today, 200),
  ]);
  if (error) throw new Error("No se han podido cargar las asignaturas.");

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    topicCount: (row.topics as unknown as { count: number }[])[0]?.count ?? 0,
    nextExam: exams.find((e) => e.subjectId === row.id) ?? null,
  }));
}

export async function getSubjectDetail(
  subjectId: string,
): Promise<{ subject: Subject; topics: Topic[]; exams: Exam[]; files: SubjectFile[] } | null> {
  await getCurrentUser();
  const supabase = await createClient();

  const [subjectRes, topicsRes, examsRes, filesRes] = await Promise.all([
    supabase.from("subjects").select("id,name,description").eq("id", subjectId).maybeSingle(),
    supabase
      .from("topics")
      .select("id,title,position,pages(id,title,position,updated_at)")
      .eq("subject_id", subjectId)
      .order("position")
      .order("created_at"),
    supabase.from("exams").select(EXAM_COLUMNS).eq("subject_id", subjectId).order("exam_date"),
    supabase
      .from("subject_files")
      .select("id,name,kind,size_bytes,page_count,created_at,has_text")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false }),
  ]);
  if (subjectRes.error || topicsRes.error || examsRes.error || filesRes.error) {
    throw new Error("No se ha podido cargar la asignatura.");
  }
  if (!subjectRes.data) return null;

  type PageRow = { id: string; title: string; position: number; updated_at: string };
  const topics: Topic[] = topicsRes.data.map((t) => ({
    id: t.id,
    title: t.title,
    pages: ((t.pages ?? []) as PageRow[])
      .toSorted((a, b) => a.position - b.position || a.updated_at.localeCompare(b.updated_at))
      .map((p) => ({ id: p.id, title: p.title, updatedAt: p.updated_at })),
  }));

  const files: SubjectFile[] = filesRes.data.map((f) => ({
    id: f.id,
    name: f.name,
    kind: f.kind as FileKind,
    sizeBytes: f.size_bytes,
    pageCount: f.page_count,
    hasText: f.has_text,
    createdAt: f.created_at,
  }));

  return { subject: subjectRes.data, topics, exams: examsRes.data.map(toExam), files };
}

export type RecentPage = { id: string; title: string; updatedAt: string; subjectId: string; subjectName: string };

/** Most recently edited note pages, to pick up where you left off. */
export async function listRecentPages(limit = 4): Promise<RecentPage[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pages")
    .select("id,title,updated_at,topics!inner(subject_id,subjects!inner(name))")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("No se han podido cargar los apuntes recientes.");

  return data.map((row) => {
    const topic = row.topics as unknown as { subject_id: string; subjects: { name: string } };
    return {
      id: row.id,
      title: row.title,
      updatedAt: row.updated_at,
      subjectId: topic.subject_id,
      subjectName: topic.subjects.name,
    };
  });
}

export async function getNotePage(subjectId: string, pageId: string): Promise<NotePage | null> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pages")
    .select("id,title,content,version,updated_at,topics!inner(id,title,subject_id,subjects!inner(id,name))")
    .eq("id", pageId)
    .maybeSingle();
  if (error) throw new Error("No se ha podido cargar la página.");
  if (!data) return null;

  const topic = data.topics as unknown as {
    id: string;
    title: string;
    subject_id: string;
    subjects: { id: string; name: string };
  };
  // The URL's subject must match the page's real subject.
  if (topic.subject_id !== subjectId) return null;

  const doc = parseDoc(data.content);
  return {
    id: data.id,
    title: data.title,
    content: doc.ok ? doc.value : EMPTY_DOC,
    version: data.version,
    updatedAt: data.updated_at,
    topic: { id: topic.id, title: topic.title },
    subject: { id: topic.subjects.id, name: topic.subjects.name },
  };
}

/** id + name of every subject, for pickers (e.g. adding an exam from the calendar). */
export async function listSubjectOptions(): Promise<{ id: string; name: string }[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("subjects").select("id,name").order("name");
  if (error) throw new Error("No se han podido cargar las asignaturas.");
  return data;
}
