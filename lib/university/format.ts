import { daysBetween } from "@/lib/tasks/dates";

const dayMonth = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: "UTC" });

function utc(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "20 nov." split into parts for a calendar badge. */
export function dateBadge(date: string): { day: string; month: string } {
  const d = utc(date);
  const parts = dayMonth.formatToParts(d);
  return {
    day: parts.find((p) => p.type === "day")?.value ?? "",
    month: (parts.find((p) => p.type === "month")?.value ?? "").replace(".", ""),
  };
}

/** Relative wording for an upcoming exam. */
export function examCountdown(date: string, today: string): string {
  const diff = daysBetween(today, date);
  if (diff < 0) return diff === -1 ? "Fue ayer" : `Hace ${-diff} días`;
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff < 7) {
    const name = weekday.format(utc(date));
    return `Este ${name}`;
  }
  return `En ${diff} días`;
}

export function formatGrade(grade: number): string {
  return grade.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

const relative = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

/** "hace 5 minutos" style label for last edits. */
export function editedAgo(iso: string, now: Date): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "ahora mismo";
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), "hour");
  return relative.format(Math.round(seconds / 86_400), "day");
}
