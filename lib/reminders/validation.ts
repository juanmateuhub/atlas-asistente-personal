import { isValidDate } from "@/lib/tasks/validation";
import { zonedToInstant } from "./time";

export const REMINDER_TITLE_MAX = 200;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type ReminderInput = { title: string; remindAt: string };

/** Title + date + time (Madrid wall time). The moment can't be in the past. */
export function parseReminderInput(
  fd: FormData,
  now = new Date(),
): { ok: true; value: ReminderInput } | { ok: false; error: string } {
  const text = (k: string) => String(fd.get(k) ?? "").trim();
  const title = text("title");
  const date = text("date");
  const time = text("time");

  if (!title) return { ok: false, error: "Escribe qué quieres que te recuerde." };
  if (title.length > REMINDER_TITLE_MAX) {
    return { ok: false, error: `El recordatorio no puede pasar de ${REMINDER_TITLE_MAX} caracteres.` };
  }
  if (!isValidDate(date)) return { ok: false, error: "Elige el día del recordatorio." };
  if (!TIME.test(time)) return { ok: false, error: "Elige la hora del recordatorio." };

  const remindAt = zonedToInstant(date, time);
  // One minute of slack: "now" typed in the form is still valid.
  if (Date.parse(remindAt) < now.getTime() - 60_000) return { ok: false, error: "Esa hora ya ha pasado." };
  return { ok: true, value: { title, remindAt } };
}
