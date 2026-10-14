import { isValidDate } from "@/lib/tasks/validation";
import type { DocJSON } from "./types";

export const NAME_MAX = 100;
export const DESCRIPTION_MAX = 500;
export const TITLE_MAX = 150;
export const LOCATION_MAX = 150;
/** Mirrors the DB check (pg_column_size ≤ 512000) with margin. */
export const CONTENT_MAX_BYTES = 450_000;

export type FormState = { error?: string; ok?: boolean };

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export function parseSubjectInput(fd: FormData): Result<{ name: string; description: string | null }> {
  const name = text(fd, "name");
  const description = text(fd, "description");
  if (!name) return { ok: false, error: "Escribe el nombre de la asignatura." };
  if (name.length > NAME_MAX) return { ok: false, error: `El nombre no puede pasar de ${NAME_MAX} caracteres.` };
  if (description.length > DESCRIPTION_MAX) {
    return { ok: false, error: `La descripción no puede pasar de ${DESCRIPTION_MAX} caracteres.` };
  }
  return { ok: true, value: { name, description: description || null } };
}

const MISSING_TITLE = {
  tema: "Escribe un título para el tema.",
  página: "Escribe un título para la página.",
  examen: "Escribe un título para el examen.",
} as const;

/** Topic, page and exam titles share the same rules. */
export function parseTitle(fd: FormData, what: keyof typeof MISSING_TITLE): Result<string> {
  const title = text(fd, "title");
  if (!title) return { ok: false, error: MISSING_TITLE[what] };
  if (title.length > TITLE_MAX) return { ok: false, error: `El título no puede pasar de ${TITLE_MAX} caracteres.` };
  return { ok: true, value: title };
}

export type ExamInput = {
  title: string;
  date: string;
  time: string | null;
  location: string | null;
  grade: number | null;
};

export function parseExamInput(fd: FormData): Result<ExamInput> {
  const title = parseTitle(fd, "examen");
  if (!title.ok) return title;

  const date = text(fd, "date");
  const time = text(fd, "time");
  const location = text(fd, "location");
  const gradeRaw = text(fd, "grade").replace(",", ".");

  if (!isValidDate(date)) return { ok: false, error: "Elige la fecha del examen." };
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { ok: false, error: "La hora no es válida." };
  if (location.length > LOCATION_MAX) {
    return { ok: false, error: `El lugar no puede pasar de ${LOCATION_MAX} caracteres.` };
  }

  let grade: number | null = null;
  if (gradeRaw) {
    grade = Number(gradeRaw);
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(gradeRaw) || grade < 0 || grade > 10) {
      return { ok: false, error: "La nota debe estar entre 0 y 10." };
    }
  }

  return {
    ok: true,
    value: { title: title.value, date, time: time || null, location: location || null, grade },
  };
}

/** Accepts only a Tiptap doc object within the size limit. */
export function parseDoc(value: unknown): Result<DocJSON> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (value as { type?: unknown }).type !== "doc"
  ) {
    return { ok: false, error: "Formato de documento no válido." };
  }
  const content = (value as { content?: unknown }).content;
  if (content !== undefined && !Array.isArray(content)) {
    return { ok: false, error: "Formato de documento no válido." };
  }
  const bytes = new TextEncoder().encode(JSON.stringify(value)).length;
  if (bytes > CONTENT_MAX_BYTES) {
    return { ok: false, error: "La página es demasiado grande. Divide los apuntes en varias páginas." };
  }
  return { ok: true, value: value as DocJSON };
}
