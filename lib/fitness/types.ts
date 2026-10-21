/** One set: repetitions and the load in kg (null = bodyweight). */
export type WorkoutSet = { reps: number; weight: number | null };

/**
 * An exercise as logged in a workout, or planned in a routine. `double`: the kg
 * typed are per dumbbell or per side (two dumbbells, unilateral work), so the
 * load moved counts twice. Only stored when true.
 */
export type Exercise = { name: string; sets: WorkoutSet[]; double?: true };

/** How many times the typed load counts towards the kg moved. */
export const loadFactor = (e: Pick<Exercise, "double">) => (e.double ? 2 : 1);

export type Workout = {
  id: string;
  title: string;
  /** `YYYY-MM-DD` */
  date: string;
  notes: string | null;
  exercises: Exercise[];
};

export type Routine = {
  id: string;
  name: string;
  notes: string | null;
  exercises: Exercise[];
};

export type BodyWeight = { id: string; date: string; weightKg: number };

export const WORKOUT_COLUMNS = "id,title,workout_date,notes,exercises";
export const ROUTINE_COLUMNS = "id,name,notes,exercises";

type WorkoutRow = { id: string; title: string; workout_date: string; notes: string | null; exercises: unknown };
type RoutineRow = { id: string; name: string; notes: string | null; exercises: unknown };

/** Rows are written through the validators, but stay defensive when reading JSON. */
export function asExercises(value: unknown): Exercise[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((e) => {
    if (!e || typeof e !== "object" || typeof e.name !== "string" || !Array.isArray(e.sets)) return [];
    const sets = (e.sets as unknown[]).flatMap((s) => {
      if (!s || typeof s !== "object") return [];
      const { reps, weight } = s as Record<string, unknown>;
      if (typeof reps !== "number") return [];
      return [{ reps, weight: typeof weight === "number" ? weight : null }];
    });
    return [{ name: e.name, sets, ...(e.double === true && { double: true as const }) }];
  });
}

export function toWorkout(row: WorkoutRow): Workout {
  return { id: row.id, title: row.title, date: row.workout_date, notes: row.notes, exercises: asExercises(row.exercises) };
}

export function toRoutine(row: RoutineRow): Routine {
  return { id: row.id, name: row.name, notes: row.notes, exercises: asExercises(row.exercises) };
}
