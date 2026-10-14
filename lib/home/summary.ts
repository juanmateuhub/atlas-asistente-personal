import { daysBetween } from "@/lib/tasks/dates";
import type { Task } from "@/lib/tasks/types";
import type { ExamSummary } from "@/lib/university/types";

/** Greeting by local hour (0–23). */
export function greeting(hour: number): string {
  if (hour >= 6 && hour < 14) return "Buenos días";
  if (hour >= 14 && hour < 21) return "Buenas tardes";
  return "Buenas noches";
}

/** Hour of day (0–23) in the given time zone. */
export function hourIn(now: Date, timeZone = "Europe/Madrid"): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(now),
  );
}

const longDate = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "Miércoles, 14 de octubre" for a `YYYY-MM-DD` date. */
export function formatLongDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const text = longDate.format(new Date(Date.UTC(y, m - 1, d)));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type DayCounts = { overdue: number; today: number; examsThisWeek: number; nextExam: ExamSummary | null };

export function countDay(tasks: Task[], exams: ExamSummary[], today: string): DayCounts {
  let overdue = 0;
  let dueToday = 0;
  for (const t of tasks) {
    if (t.status === "hecha" || !t.dueDate) continue;
    const diff = daysBetween(today, t.dueDate);
    if (diff < 0) overdue++;
    else if (diff === 0) dueToday++;
  }
  const upcoming = exams.filter((e) => daysBetween(today, e.date) >= 0);
  return {
    overdue,
    today: dueToday,
    examsThisWeek: upcoming.filter((e) => daysBetween(today, e.date) < 7).length,
    nextExam: upcoming[0] ?? null,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One plain sentence that tells the user what matters today. */
export function daySentence(c: DayCounts): string {
  const parts: string[] = [];
  if (c.today > 0) parts.push(`${plural(c.today, "tarea", "tareas")} para hoy`);
  if (c.overdue > 0) parts.push(`${plural(c.overdue, "atrasada", "atrasadas")}`);
  if (c.examsThisWeek > 0) parts.push(`${plural(c.examsThisWeek, "examen", "exámenes")} esta semana`);

  if (parts.length === 0) {
    return c.nextExam ? `Día tranquilo. Tu próximo examen es ${c.nextExam.title}.` : "Día tranquilo. Nada urgente por ahora.";
  }
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}`;
  return `Tienes ${list}.`;
}
