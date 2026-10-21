import { isValidDate } from "@/lib/tasks/validation";
import type { Exercise, WorkoutSet } from "./types";

export const TITLE_MAX = 80;
export const NOTES_MAX = 2000;
export const EXERCISE_NAME_MAX = 60;
export const EXERCISES_MAX = 30;
export const SETS_MAX = 20;
export const REPS_MAX = 1000;
export const WEIGHT_MAX = 1000;
export const BODY_WEIGHT_MIN = 20;
export const BODY_WEIGHT_MAX = 400;

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export type FitnessFormState = { error?: string; ok?: boolean };

/** Accepts "62,5" as well as "62.5". */
export function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const s = value.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** Rounds to the nearest 0.25 kg (the smallest plates), dropping float noise. */
const roundWeight = (kg: number) => Math.round(kg * 4) / 4;

/** Normalises an exercise name: single spaces, first letter upper case. */
export function cleanExerciseName(name: string): string {
  const s = name.replace(/\s+/g, " ").trim();
  return s.charAt(0).toLocaleUpperCase("es") + s.slice(1);
}

function parseSet(raw: unknown, index: number, exercise: string): Parsed<WorkoutSet> {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const reps = parseNumber(s.reps);
  if (reps === null || !Number.isInteger(reps) || reps < 0 || reps > REPS_MAX) {
    return { ok: false, error: `Las repeticiones de la serie ${index + 1} de ${exercise} no son válidas.` };
  }
  const empty = s.weight === null || s.weight === undefined || s.weight === "";
  const weight = empty ? null : parseNumber(s.weight);
  if (!empty && (weight === null || weight < 0 || weight > WEIGHT_MAX)) {
    return { ok: false, error: `El peso de la serie ${index + 1} de ${exercise} no es válido.` };
  }
  return { ok: true, value: { reps, weight: weight === null ? null : roundWeight(weight) } };
}

/**
 * Validates a list of exercises (from the editor's JSON or from Jax).
 * Exercises without a name and with no sets are dropped: they are empty rows.
 */
export function parseExercises(raw: unknown): Parsed<Exercise[]> {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return { ok: false, error: "Los ejercicios no son válidos." };
    }
  }
  if (!Array.isArray(value)) return { ok: false, error: "Los ejercicios no son válidos." };

  const exercises: Exercise[] = [];
  for (const item of value) {
    const e = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const name = cleanExerciseName(typeof e.name === "string" ? e.name : "");
    const rawSets = Array.isArray(e.sets) ? e.sets : [];
    if (!name && rawSets.length === 0) continue;
    if (!name) return { ok: false, error: "Ponle nombre a cada ejercicio." };
    if (name.length > EXERCISE_NAME_MAX) {
      return { ok: false, error: `El nombre de un ejercicio no puede pasar de ${EXERCISE_NAME_MAX} caracteres.` };
    }
    if (rawSets.length > SETS_MAX) return { ok: false, error: `Como mucho ${SETS_MAX} series por ejercicio.` };
    const sets: WorkoutSet[] = [];
    for (const [i, s] of rawSets.entries()) {
      const set = parseSet(s, i, name);
      if (!set.ok) return set;
      sets.push(set.value);
    }
    exercises.push({ name, sets, ...(e.double === true && { double: true as const }) });
  }
  if (exercises.length > EXERCISES_MAX) return { ok: false, error: `Como mucho ${EXERCISES_MAX} ejercicios.` };
  return { ok: true, value: exercises };
}

/** "3 x 8 a 60 kg" style shorthand, used by Jax: n equal sets. */
export function expandSets(sets: number, reps: number, weight: number | null): WorkoutSet[] {
  return Array.from({ length: sets }, () => ({ reps, weight }));
}

export type WorkoutInput = { title: string; date: string; notes: string | null; exercises: Exercise[] };

export function parseWorkoutInput(fd: FormData): Parsed<WorkoutInput> {
  const title = String(fd.get("title") ?? "").trim();
  const date = String(fd.get("date") ?? "").trim();
  const notes = String(fd.get("notes") ?? "").trim();
  if (!title) return { ok: false, error: "Ponle un nombre al entreno." };
  if (title.length > TITLE_MAX) return { ok: false, error: `El nombre no puede pasar de ${TITLE_MAX} caracteres.` };
  if (!isValidDate(date)) return { ok: false, error: "Elige la fecha del entreno." };
  if (notes.length > NOTES_MAX) return { ok: false, error: `Las notas no pueden pasar de ${NOTES_MAX} caracteres.` };
  const exercises = parseExercises(fd.get("exercises") ?? "[]");
  if (!exercises.ok) return exercises;
  return { ok: true, value: { title, date, notes: notes || null, exercises: exercises.value } };
}

export type RoutineInput = { name: string; notes: string | null; exercises: Exercise[] };

export function parseRoutineInput(fd: FormData): Parsed<RoutineInput> {
  const name = String(fd.get("name") ?? "").trim();
  const notes = String(fd.get("notes") ?? "").trim();
  if (!name) return { ok: false, error: "Ponle un nombre a la rutina." };
  if (name.length > TITLE_MAX) return { ok: false, error: `El nombre no puede pasar de ${TITLE_MAX} caracteres.` };
  if (notes.length > NOTES_MAX) return { ok: false, error: `Las notas no pueden pasar de ${NOTES_MAX} caracteres.` };
  const exercises = parseExercises(fd.get("exercises") ?? "[]");
  if (!exercises.ok) return exercises;
  return { ok: true, value: { name, notes: notes || null, exercises: exercises.value } };
}

export type BodyWeightInput = { date: string; weightKg: number };

export function parseBodyWeightInput(fd: FormData): Parsed<BodyWeightInput> {
  const date = String(fd.get("date") ?? "").trim();
  const kg = parseNumber(fd.get("weight"));
  if (!isValidDate(date)) return { ok: false, error: "Elige la fecha." };
  if (kg === null || kg < BODY_WEIGHT_MIN || kg > BODY_WEIGHT_MAX) {
    return { ok: false, error: `Escribe tu peso en kg (entre ${BODY_WEIGHT_MIN} y ${BODY_WEIGHT_MAX}).` };
  }
  return { ok: true, value: { date, weightKg: Math.round(kg * 100) / 100 } };
}
