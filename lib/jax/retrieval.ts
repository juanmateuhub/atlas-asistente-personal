import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JaxData } from "./context";
import { addDays } from "./dates";
import { docToText } from "./doc-text";
import { chunkText, keywords, searchPages, type PageHit, type SearchablePage } from "./search";
import { emptyRefs, type RefMap } from "./tools";

/**
 * Deterministic retrieval of the caller's data. Runs with the user's Supabase
 * client, so RLS limits every query to their own rows. Every item the model may
 * change gets a short ref (t1, e1, x1, s1, tp1) that maps back to its UUID.
 */
export async function retrieveData(
  supabase: SupabaseClient,
  question: string,
  today: string,
  now: string,
): Promise<{ data: JaxData; refs: RefMap }> {
  const terms = keywords(question);
  const [tasks, exams, events, subjects, pages, files] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,due_date,priority,status")
      .neq("status", "hecha")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(60),
    supabase
      .from("exams")
      .select("id,title,exam_date,exam_time,location,grade,subjects(name)")
      .gte("exam_date", addDays(today, -30))
      .order("exam_date")
      .limit(40),
    supabase
      .from("events")
      .select("id,title,event_date,start_time,end_time,location")
      .gte("event_date", addDays(today, -7))
      .lte("event_date", addDays(today, 60))
      .order("event_date")
      .order("start_time", { nullsFirst: true })
      .limit(80),
    supabase.from("subjects").select("id,name,description,topics(id,title,position)").order("name").limit(50),
    supabase
      .from("pages")
      .select("id,title,content,topics!inner(title,subject_id,subjects!inner(name))")
      .order("updated_at", { ascending: false })
      .limit(150),
    // Uploaded documents: Postgres full-text search (Spanish) picks the few that match.
    terms.length
      ? supabase
          .from("subject_files")
          .select("id,name,subject_id,text_content,subjects(name)")
          .eq("has_text", true)
          .textSearch("search", terms.join(" or "), { type: "websearch", config: "spanish" })
          .limit(3)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const failed = [tasks, exams, events, subjects, pages, files].find((r) => r.error);
  if (failed) throw new Error("retrieval failed");

  const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);
  const refs = emptyRefs();

  const taskItems = (tasks.data ?? []).map((t, i) => {
    const ref = `t${i + 1}`;
    refs.t.set(ref, {
      id: t.id,
      label: t.title,
      values: { title: t.title, priority: t.priority, status: t.status, due_date: t.due_date },
    });
    return { ref, title: t.title, dueDate: t.due_date, priority: t.priority, status: t.status };
  });

  const examItems = (exams.data ?? []).map((e, i) => {
    const ref = `x${i + 1}`;
    const grade = e.grade === null ? null : Number(e.grade);
    refs.x.set(ref, {
      id: e.id,
      label: e.title,
      values: { title: e.title, exam_date: e.exam_date, exam_time: hhmm(e.exam_time), location: e.location, grade },
    });
    return {
      ref,
      title: e.title,
      subjectName: (e.subjects as unknown as { name: string } | null)?.name ?? "",
      date: e.exam_date,
      time: hhmm(e.exam_time),
      location: e.location,
      grade,
    };
  });

  const eventItems = (events.data ?? []).map((e, i) => {
    const ref = `e${i + 1}`;
    refs.e.set(ref, {
      id: e.id,
      label: e.title,
      values: {
        title: e.title,
        event_date: e.event_date,
        start_time: hhmm(e.start_time),
        end_time: hhmm(e.end_time),
        location: e.location,
      },
    });
    return { ref, title: e.title, date: e.event_date, startTime: hhmm(e.start_time), endTime: hhmm(e.end_time), location: e.location };
  });

  let topicCounter = 0;
  const subjectItems = (subjects.data ?? []).map((s, i) => {
    const ref = `s${i + 1}`;
    refs.s.set(ref, { id: s.id, label: s.name, values: { name: s.name } });
    const topics = ((s.topics ?? []) as { id: string; title: string; position: number }[])
      .toSorted((a, b) => a.position - b.position)
      .map((t) => {
        const topicRef = `tp${++topicCounter}`;
        refs.tp.set(topicRef, { id: t.id, label: `${t.title} (${s.name})`, values: { title: t.title } });
        return { ref: topicRef, title: t.title };
      });
    return { ref, name: s.name, description: s.description, topics };
  });

  const searchable: SearchablePage[] = (pages.data ?? []).map((p) => {
    const topic = p.topics as unknown as { title: string; subject_id: string; subjects: { name: string } };
    return {
      id: p.id,
      title: p.title,
      subjectId: topic.subject_id,
      subjectName: topic.subjects.name,
      topicTitle: topic.title,
      text: docToText(p.content),
    };
  });

  return {
    data: {
      today,
      now,
      tasks: taskItems,
      exams: examItems,
      events: eventItems,
      subjects: subjectItems,
      notes: rankSources(searchPages(searchable, question), documentHits(files.data ?? [], question)),
    },
    refs,
  };
}

type FileRow = { id: string; name: string; subject_id: string; text_content: string; subjects: unknown };

/** Best passages of each matching document, scored like note pages. */
function documentHits(rows: FileRow[], question: string): PageHit[] {
  return rows.flatMap((f) => {
    const subjectName = (f.subjects as { name: string } | null)?.name ?? "";
    const chunks: SearchablePage[] = chunkText(f.text_content).map((text) => ({
      id: f.id,
      source: "file",
      subjectId: f.subject_id,
      subjectName,
      topicTitle: "Documentos",
      title: f.name,
      text,
    }));
    return searchPages(chunks, question, 2, 1500);
  });
}

/** Mix note pages and document passages, best first, within the prompt budget. */
function rankSources(pages: PageHit[], documents: PageHit[], limit = 5): PageHit[] {
  return [...pages, ...documents].sort((a, b) => b.score - a.score).slice(0, limit);
}
