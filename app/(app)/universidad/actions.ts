"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { parseTaskId as parseId } from "@/lib/tasks/validation";
import {
  parseDoc,
  parseExamInput,
  parseSubjectInput,
  parseTitle,
  type FormState,
} from "@/lib/university/validation";

// user_id is never read from the client: the DB defaults it to auth.uid(), RLS
// rejects foreign rows and composite FKs reject foreign parents.

const FAILED = "No se ha podido guardar. Inténtalo de nuevo.";

// Subjects ---------------------------------------------------------------------

export async function createSubject(_prev: FormState, fd: FormData): Promise<FormState> {
  await getCurrentUser();
  const parsed = parseSubjectInput(fd);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("subjects").insert(parsed.value).select("id").single();
  if (error) return { error: FAILED };
  redirect(`/universidad/${data.id}`);
}

export async function updateSubject(_prev: FormState, fd: FormData): Promise<FormState> {
  await getCurrentUser();
  const id = parseId(fd.get("id"));
  const parsed = parseSubjectInput(fd);
  if (!id) return { error: "Asignatura no válida." };
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("subjects").update(parsed.value).eq("id", id).select("id");
  if (error || data.length === 0) return { error: FAILED };
  refresh();
  return { ok: true };
}

export async function deleteSubject(_prev: FormState, fd: FormData): Promise<FormState> {
  await getCurrentUser();
  const id = parseId(fd.get("id"));
  if (!id) return { error: "Asignatura no válida." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("subjects").delete().eq("id", id).select("id");
  if (error || data.length === 0) return { error: "No se ha podido borrar. Inténtalo de nuevo." };
  redirect("/universidad");
}

// Topics -----------------------------------------------------------------------

export async function createTopic(_prev: FormState, fd: FormData): Promise<FormState> {
  await getCurrentUser();
  const subjectId = parseId(fd.get("subjectId"));
  const title = parseTitle(fd, "tema");
  if (!subjectId) return { error: "Asignatura no válida." };
  if (!title.ok) return { error: title.error };

  const supabase = await createClient();
  const { count } = await supabase
    .from("topics")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", subjectId);
  const { error } = await supabase
    .from("topics")
    .insert({ subject_id: subjectId, title: title.value, position: count ?? 0 });
  if (error) return { error: FAILED };
  refresh();
  return { ok: true };
}

export async function renameTopic(_prev: FormState, fd: FormData): Promise<FormState> {
  await getCurrentUser();
  const id = parseId(fd.get("id"));
  const title = parseTitle(fd, "tema");
  if (!id) return { error: "Tema no válido." };
  if (!title.ok) return { error: title.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("topics").update({ title: title.value }).eq("id", id).select("id");
  if (error || data.length === 0) return { error: FAILED };
  refresh();
  return { ok: true };
}

export async function deleteTopic(_prev: FormState, fd: FormData): Promise<FormState> {
  await getCurrentUser();
  const id = parseId(fd.get("id"));
  if (!id) return { error: "Tema no válido." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("topics").delete().eq("id", id).select("id");
  if (error || data.length === 0) return { error: "No se ha podido borrar. Inténtalo de nuevo." };
  refresh();
  return { ok: true };
}

// Pages ------------------------------------------------------------------------

export async function createPage(_prev: FormState, fd: FormData): Promise<FormState> {
  await getCurrentUser();
  const subjectId = parseId(fd.get("subjectId"));
  const topicId = parseId(fd.get("topicId"));
  const title = parseTitle(fd, "página");
  if (!subjectId || !topicId) return { error: "Tema no válido." };
  if (!title.ok) return { error: title.error };

  const supabase = await createClient();
  const { count } = await supabase
    .from("pages")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", topicId);
  const { data, error } = await supabase
    .from("pages")
    .insert({ topic_id: topicId, title: title.value, position: count ?? 0 })
    .select("id")
    .single();
  if (error) return { error: FAILED };
  redirect(`/universidad/${subjectId}/paginas/${data.id}`);
}

export type SaveResult =
  | { ok: true; version: number; savedAt: string }
  | { ok: false; reason: "conflict" | "invalid" | "error"; message: string };

/**
 * Autosave with optimistic concurrency: only writes if the row is still at
 * `expectedVersion`, so a stale tab can't overwrite newer notes.
 */
export async function savePageContent(
  pageId: string,
  content: unknown,
  expectedVersion: number,
): Promise<SaveResult> {
  await getCurrentUser();
  const id = parseId(pageId);
  const doc = parseDoc(content);
  if (!id || !Number.isInteger(expectedVersion)) {
    return { ok: false, reason: "invalid", message: "Página no válida." };
  }
  if (!doc.ok) return { ok: false, reason: "invalid", message: doc.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pages")
    .update({ content: doc.value, version: expectedVersion + 1 })
    .eq("id", id)
    .eq("version", expectedVersion)
    .select("version,updated_at");
  if (error) return { ok: false, reason: "error", message: "No se ha podido guardar. Reintentando…" };
  if (data.length === 0) {
    return {
      ok: false,
      reason: "conflict",
      message: "Esta página se ha cambiado en otra pestaña. Recarga para ver la última versión.",
    };
  }
  return { ok: true, version: data[0].version, savedAt: data[0].updated_at };
}

export async function renamePage(pageId: string, title: string): Promise<FormState> {
  await getCurrentUser();
  const id = parseId(pageId);
  const fd = new FormData();
  fd.set("title", title);
  const parsed = parseTitle(fd, "página");
  if (!id) return { error: "Página no válida." };
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("pages").update({ title: parsed.value }).eq("id", id).select("id");
  if (error || data.length === 0) return { error: FAILED };
  return { ok: true };
}

export async function deletePage(_prev: FormState, fd: FormData): Promise<FormState> {
  await getCurrentUser();
  const id = parseId(fd.get("id"));
  const subjectId = parseId(fd.get("subjectId"));
  if (!id || !subjectId) return { error: "Página no válida." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("pages").delete().eq("id", id).select("id");
  if (error || data.length === 0) return { error: "No se ha podido borrar. Inténtalo de nuevo." };
  redirect(`/universidad/${subjectId}`);
}

// Exams ------------------------------------------------------------------------

function examRow(value: ReturnType<typeof parseExamInput> & { ok: true }) {
  const { title, date, time, location, grade } = value.value;
  return { title, exam_date: date, exam_time: time, location, grade };
}

export async function createExam(_prev: FormState, fd: FormData): Promise<FormState> {
  await getCurrentUser();
  const subjectId = parseId(fd.get("subjectId"));
  const parsed = parseExamInput(fd);
  if (!subjectId) return { error: "Asignatura no válida." };
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("exams").insert({ subject_id: subjectId, ...examRow(parsed) });
  if (error) return { error: FAILED };
  refresh();
  return { ok: true };
}

export async function updateExam(_prev: FormState, fd: FormData): Promise<FormState> {
  await getCurrentUser();
  const id = parseId(fd.get("id"));
  const parsed = parseExamInput(fd);
  if (!id) return { error: "Examen no válido." };
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("exams").update(examRow(parsed)).eq("id", id).select("id");
  if (error || data.length === 0) return { error: FAILED };
  refresh();
  return { ok: true };
}

export async function deleteExam(_prev: FormState, fd: FormData): Promise<FormState> {
  await getCurrentUser();
  const id = parseId(fd.get("id"));
  if (!id) return { error: "Examen no válido." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("exams").delete().eq("id", id).select("id");
  if (error || data.length === 0) return { error: "No se ha podido borrar. Inténtalo de nuevo." };
  refresh();
  return { ok: true };
}
