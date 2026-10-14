import "server-only";
import { getCurrentUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { TASK_COLUMNS, toTask, type Task, type TaskFilter } from "./types";

const PRIORITY_RANK = { alta: 0, media: 1, baja: 2 } as const;

/** Current user's tasks. RLS restricts rows to the owner; the user check is defence in depth. */
export async function listTasks(filter: TaskFilter): Promise<Task[]> {
  await getCurrentUser();
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(500);

  if (filter === "pendientes") query = query.neq("status", "hecha");
  if (filter === "hechas") query = query.eq("status", "hecha");

  const { data, error } = await query;
  if (error) throw new Error("No se han podido cargar las tareas.");

  return sortByDueAndPriority(data.map(toTask));
}

/** Open tasks due on or before `until` (overdue included), for the home summary. */
export async function listOpenTasksDueBy(until: string): Promise<Task[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .neq("status", "hecha")
    .lte("due_date", until)
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw new Error("No se han podido cargar las tareas.");
  return sortByDueAndPriority(data.map(toTask));
}

function sortByDueAndPriority(tasks: Task[]): Task[] {
  // Same due date: higher priority first. Sort is stable, so DB order is kept otherwise.
  return tasks.sort((a, b) =>
    a.dueDate === b.dueDate ? PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] : 0,
  );
}
