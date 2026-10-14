import { PRIORITIES, STATUSES, type Priority, type Status } from "./types";

export const TITLE_MAX = 200;
export const NOTES_MAX = 2000;

export type TaskInput = {
  title: string;
  notes: string | null;
  priority: Priority;
  status: Status;
  dueDate: string | null;
};

/** `title` echoes the submitted title on error so the form can restore it. */
export type TaskFormState = { error?: string; ok?: boolean; title?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseTaskId(value: FormDataEntryValue | null): string | null {
  const id = String(value ?? "");
  return UUID.test(id) ? id : null;
}

/** `YYYY-MM-DD` that is a real calendar date. */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function parseTaskInput(
  formData: FormData,
): { ok: true; value: TaskInput } | { ok: false; error: string } {
  const title = String(formData.get("title") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const priority = String(formData.get("priority") ?? "media");
  const status = String(formData.get("status") ?? "pendiente");
  const dueRaw = String(formData.get("dueDate") ?? "").trim();

  if (!title) return { ok: false, error: "Escribe un título para la tarea." };
  if (title.length > TITLE_MAX) {
    return { ok: false, error: `El título no puede pasar de ${TITLE_MAX} caracteres.` };
  }
  if (notesRaw.length > NOTES_MAX) {
    return { ok: false, error: `Las notas no pueden pasar de ${NOTES_MAX} caracteres.` };
  }
  if (!(PRIORITIES as readonly string[]).includes(priority)) {
    return { ok: false, error: "Prioridad no válida." };
  }
  if (!(STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: "Estado no válido." };
  }
  if (dueRaw && !isValidDate(dueRaw)) {
    return { ok: false, error: "La fecha no es válida." };
  }

  return {
    ok: true,
    value: {
      title,
      notes: notesRaw || null,
      priority: priority as Priority,
      status: status as Status,
      dueDate: dueRaw || null,
    },
  };
}
