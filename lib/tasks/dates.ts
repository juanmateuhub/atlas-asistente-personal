export const APP_TIME_ZONE = "Europe/Madrid";

/** Today's calendar date in Madrid as `YYYY-MM-DD`. */
export function todayIn(now: Date, timeZone = APP_TIME_ZONE): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Whole days from `today` to `date` (both `YYYY-MM-DD`). Negative = past. */
export function daysBetween(today: string, date: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(date) - toUtc(today)) / 86_400_000);
}

export type DueInfo = { label: string; tone: "overdue" | "soon" | "normal" };

const shortDate = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function dueInfo(dueDate: string, today: string): DueInfo {
  const diff = daysBetween(today, dueDate);
  if (diff < 0) {
    return { label: diff === -1 ? "Venció ayer" : `Venció hace ${-diff} días`, tone: "overdue" };
  }
  if (diff === 0) return { label: "Vence hoy", tone: "soon" };
  if (diff === 1) return { label: "Vence mañana", tone: "soon" };
  if (diff < 7) return { label: `En ${diff} días`, tone: "normal" };
  const [y, m, d] = dueDate.split("-").map(Number);
  return { label: shortDate.format(new Date(Date.UTC(y, m - 1, d))), tone: "normal" };
}
