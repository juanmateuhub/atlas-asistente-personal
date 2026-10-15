import { APP_TIME_ZONE } from "@/lib/tasks/dates";

const time = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: APP_TIME_ZONE });
const dayMonth = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: APP_TIME_ZONE });
const full = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "numeric", year: "2-digit", timeZone: APP_TIME_ZONE });
const long = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: APP_TIME_ZONE,
});
const ymd = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: APP_TIME_ZONE });

/** Inbox column: "09:41" today, "14 oct" this year, "14/10/25" before. */
export function inboxDate(iso: string, now: Date): string {
  const d = new Date(iso);
  const [a, b] = [ymd.format(d), ymd.format(now)];
  if (a === b) return time.format(d);
  if (a.slice(0, 4) === b.slice(0, 4)) return dayMonth.format(d).replace(".", "");
  return full.format(d);
}

/** Message header: "Jueves, 15 de octubre, 09:41". */
export function messageDate(iso: string): string {
  const text = long.format(new Date(iso));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Opens the message in Gmail under the right account. */
export function gmailUrl(account: string, id: string): string {
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(account)}#all/${id}`;
}
