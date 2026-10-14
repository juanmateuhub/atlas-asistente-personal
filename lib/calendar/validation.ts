import { isValidDate } from "@/lib/tasks/validation";

export const TITLE_MAX = 150;
export const LOCATION_MAX = 150;
export const NOTES_MAX = 2000;

export type EventInput = {
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseEventInput(fd: FormData): { ok: true; value: EventInput } | { ok: false; error: string } {
  const text = (k: string) => String(fd.get(k) ?? "").trim();
  const title = text("title");
  const date = text("date");
  const allDay = fd.get("allDay") === "on";
  const startTime = allDay ? "" : text("startTime");
  const endTime = allDay ? "" : text("endTime");
  const location = text("location");
  const notes = text("notes");

  if (!title) return { ok: false, error: "Escribe un título para el evento." };
  if (title.length > TITLE_MAX) return { ok: false, error: `El título no puede pasar de ${TITLE_MAX} caracteres.` };
  if (!isValidDate(date)) return { ok: false, error: "Elige la fecha del evento." };
  if (startTime && !TIME.test(startTime)) return { ok: false, error: "La hora de inicio no es válida." };
  if (endTime && !TIME.test(endTime)) return { ok: false, error: "La hora de fin no es válida." };
  if (endTime && !startTime) return { ok: false, error: "Indica la hora de inicio antes que la de fin." };
  if (startTime && endTime && endTime <= startTime) {
    return { ok: false, error: "La hora de fin debe ser posterior a la de inicio." };
  }
  if (location.length > LOCATION_MAX) return { ok: false, error: `El lugar no puede pasar de ${LOCATION_MAX} caracteres.` };
  if (notes.length > NOTES_MAX) return { ok: false, error: `Las notas no pueden pasar de ${NOTES_MAX} caracteres.` };

  return {
    ok: true,
    value: {
      title,
      date,
      startTime: startTime || null,
      endTime: endTime || null,
      location: location || null,
      notes: notes || null,
    },
  };
}
