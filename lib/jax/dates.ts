/** `YYYY-MM-DD` plus `days` (can be negative). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** `HH:MM` in the given time zone. */
export function timeIn(now: Date, timeZone = "Europe/Madrid"): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(now);
}

const weekdayFmt = new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: "UTC" });

/** Spanish weekday of a `YYYY-MM-DD` date: "jueves". */
export function weekdayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return weekdayFmt.format(new Date(Date.UTC(y, m - 1, d)));
}

/** "viernes 2026-10-16, sábado 2026-10-17, …" for the `days` after `today`, so the model never guesses weekdays. */
export function daysAhead(today: string, days: number): string {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i + 1);
    return `${weekdayOf(date)} ${date}`;
  }).join(", ");
}
