import { APP_TIME_ZONE } from "@/lib/tasks/dates";

/** Offset of `timeZone` from UTC at `instant`, in minutes (Madrid: +60 in winter, +120 in summer). */
function offsetMinutes(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - instant) / 60_000);
}

/**
 * Wall time in Madrid (`YYYY-MM-DD` + `HH:MM`) → UTC instant (ISO). Twice, so a
 * time right after a DST change uses the offset in force at that moment.
 */
export function zonedToInstant(date: string, time: string, timeZone = APP_TIME_ZONE): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min);
  let instant = wall - offsetMinutes(wall, timeZone) * 60_000;
  instant = wall - offsetMinutes(instant, timeZone) * 60_000;
  return new Date(instant).toISOString();
}

/** UTC instant → Madrid wall time. */
export function instantToZoned(iso: string, timeZone = APP_TIME_ZONE): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
