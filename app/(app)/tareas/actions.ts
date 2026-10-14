"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { parseTaskId, parseTaskInput, type TaskFormState } from "@/lib/tasks/validation";

// user_id is never taken from the form: the DB defaults it to auth.uid() and RLS
// rejects any row that isn't the caller's.

export async function createTask(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  await getCurrentUser();
  const parsed = parseTaskInput(formData);
  const submittedTitle = String(formData.get("title") ?? "").slice(0, 200);
  if (!parsed.ok) return { error: parsed.error, title: submittedTitle };

  const { title, notes, priority, dueDate } = parsed.value;
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .insert({ title, notes, priority, due_date: dueDate });
  if (error) {
    return { error: "No se ha podido crear la tarea. Inténtalo de nuevo.", title: submittedTitle };
  }

  refresh();
  return { ok: true };
}

export async function updateTask(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  await getCurrentUser();
  const id = parseTaskId(formData.get("id"));
  if (!id) return { error: "Tarea no válida." };
  const parsed = parseTaskInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { title, notes, priority, status, dueDate } = parsed.value;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ title, notes, priority, status, due_date: dueDate })
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) return { error: "No se ha podido guardar. Inténtalo de nuevo." };

  refresh();
  return { ok: true };
}

export async function toggleTaskDone(formData: FormData): Promise<void> {
  await getCurrentUser();
  const id = parseTaskId(formData.get("id"));
  if (!id) return;
  const done = formData.get("done") === "true";

  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({ status: done ? "hecha" : "pendiente" })
    .eq("id", id);
  refresh();
}

export async function deleteTask(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  await getCurrentUser();
  const id = parseTaskId(formData.get("id"));
  if (!id) return { error: "Tarea no válida." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").delete().eq("id", id).select("id");
  if (error || data.length === 0) return { error: "No se ha podido borrar. Inténtalo de nuevo." };

  refresh();
  return { ok: true };
}
