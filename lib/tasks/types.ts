export const PRIORITIES = ["alta", "media", "baja"] as const;
export const STATUSES = ["pendiente", "en_curso", "hecha"] as const;

export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];

export type Task = {
  id: string;
  title: string;
  notes: string | null;
  priority: Priority;
  status: Status;
  /** Calendar date `YYYY-MM-DD` (no time zone), or null. */
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
};

/** Row shape as returned by Supabase for `public.tasks`. */
export type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
};

export const TASK_COLUMNS = "id,title,notes,priority,status,due_date,completed_at,created_at";

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    priority: (PRIORITIES as readonly string[]).includes(row.priority)
      ? (row.priority as Priority)
      : "media",
    status: (STATUSES as readonly string[]).includes(row.status)
      ? (row.status as Status)
      : "pendiente",
    dueDate: row.due_date,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export const STATUS_LABEL: Record<Status, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  hecha: "Hecha",
};

export const FILTERS = ["pendientes", "hechas", "todas"] as const;
export type TaskFilter = (typeof FILTERS)[number];

export function parseFilter(value: unknown): TaskFilter {
  return (FILTERS as readonly unknown[]).includes(value) ? (value as TaskFilter) : "pendientes";
}

const RANK: Record<Priority, number> = { alta: 0, media: 1, baja: 2 };

/** Same order as the server list: due date (none last), then priority, then creation. */
export function compareTasks(a: Task, b: Task): number {
  const da = a.dueDate ?? "9999-12-31";
  const db = b.dueDate ?? "9999-12-31";
  if (da !== db) return da < db ? -1 : 1;
  if (a.priority !== b.priority) return RANK[a.priority] - RANK[b.priority];
  return a.createdAt.localeCompare(b.createdAt);
}

/** Design filter keys → which tasks they show. Rows mid-animation stay visible. */
export function matchesFilter(done: boolean, animating: boolean, filter: TaskFilter): boolean {
  if (filter === "todas") return true;
  if (filter === "hechas") return done || animating;
  return !done || animating;
}
