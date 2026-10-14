import { isValidDate } from "@/lib/tasks/validation";

/** `YYYY-MM` */
export type MonthKey = string;

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateKey(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function monthOf(date: string): MonthKey {
  return date.slice(0, 7);
}

export function parseMonth(value: unknown, fallback: MonthKey): MonthKey {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return fallback;
  const year = Number(value.slice(0, 4));
  return year >= 1970 && year <= 2100 ? value : fallback;
}

export function parseDay(value: unknown, fallback: string): string {
  return typeof value === "string" && isValidDate(value) ? value : fallback;
}

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/**
 * Weeks (Monday first) covering the whole month, padded with days of the
 * adjacent months. Always 6 weeks so the grid height never jumps.
 */
export function monthGrid(month: MonthKey): string[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = Date.UTC(y, m - 1, 1 - offset);

  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start + (w * 7 + d) * 86_400_000);
      week.push(toDateKey(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()));
    }
    weeks.push(week);
  }
  return weeks;
}

const monthTitle = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
const dayTitle = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Octubre de 2026" */
export function formatMonth(month: MonthKey): string {
  const [y, m] = month.split("-").map(Number);
  return capitalize(monthTitle.format(new Date(Date.UTC(y, m - 1, 1))));
}

/** "Martes, 20 de octubre" */
export function formatDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return capitalize(dayTitle.format(new Date(Date.UTC(y, m - 1, d))));
}

export const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"] as const;
export const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;
