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

function sortByDueAndPriority(tasks: Task[]): Task[] {
  // Same due date: higher priority first. Sort is stable, so DB order is kept otherwise.
  return tasks.sort((a, b) =>
    a.dueDate === b.dueDate ? PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] : 0,
  );
}

/** Open tasks, for the sidebar badge. */
export async function countPendingTasks(): Promise<number> {
  await getCurrentUser();
  const supabase = await createClient();
  const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "hecha");
  return count ?? 0;
}

/**
 * The next open tasks for Inicio: today's first, then overdue ones, then the
 * coming ones by date (priority breaks ties). Undated tasks are left out.
 */
export async function listNextOpenTasks(today: string, limit = 6): Promise<Task[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const [due, upcoming] = await Promise.all([
    supabase.from("tasks").select(TASK_COLUMNS).neq("status", "hecha").lte("due_date", today).order("due_date").limit(50),
    supabase.from("tasks").select(TASK_COLUMNS).neq("status", "hecha").gt("due_date", today).order("due_date").limit(limit),
  ]);
  if (due.error || upcoming.error) throw new Error("No se han podido cargar las tareas.");
  const dueTasks = sortByDueAndPriority(due.data.map(toTask));
  const todays = dueTasks.filter((t) => t.dueDate === today);
  const overdue = dueTasks.filter((t) => t.dueDate !== today);
  return [...todays, ...overdue, ...sortByDueAndPriority(upcoming.data.map(toTask))].slice(0, Math.max(limit, todays.length));
}
