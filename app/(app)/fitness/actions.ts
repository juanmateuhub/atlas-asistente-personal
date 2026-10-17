"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/tasks/dates";
import { parseTaskId as parseId } from "@/lib/tasks/validation";
import { cleanCoachAnswer, coachData, COACH_SCHEMA, COACH_SYSTEM, type CoachAnswer } from "@/lib/fitness/coach";
import { exerciseKey, isMuscle } from "@/lib/fitness/muscles";
import { listBodyWeights, listMuscleOverrides, listWorkouts } from "@/lib/fitness/queries";
import { asExercises } from "@/lib/fitness/types";
import { generateJson } from "@/lib/jax/providers/gemini";
import { ProviderError } from "@/lib/jax/providers/types";
import {
  parseBodyWeightInput,
  parseRoutineInput,
  parseWorkoutInput,
  TITLE_MAX,
  type FitnessFormState,
} from "@/lib/fitness/validation";

// user_id is never read from the client: the DB defaults it to auth.uid() and RLS
// rejects rows that aren't the caller's.

const FAILED = "No se ha podido guardar. Inténtalo de nuevo.";

// Workouts -------------------------------------------------------------------------

/** New workout for today, empty or copied from a routine, then straight to its editor. */
export async function startWorkout(fd: FormData): Promise<void> {
  await getCurrentUser();
  const supabase = await createClient();
  const routineId = parseId(fd.get("routineId"));
  let title = "Entreno";
  let exercises: unknown[] = [];
  if (routineId) {
    const { data: routine } = await supabase.from("workout_routines").select("name,exercises").eq("id", routineId).maybeSingle();
    if (routine) {
      title = routine.name.slice(0, TITLE_MAX);
      exercises = asExercises(routine.exercises);
    }
  }
  const { data, error } = await supabase
    .from("workouts")
    .insert({ title, workout_date: todayIn(new Date()), exercises })
    .select("id")
    .single();
  if (error) throw new Error("No se ha podido empezar el entreno.");
  redirect(`/fitness/entrenos/${data.id}`);
}

export async function saveWorkout(_prev: FitnessFormState, fd: FormData): Promise<FitnessFormState> {
  await getCurrentUser();
  const id = parseId(fd.get("id"));
  if (!id) return { error: "Entreno no válido." };
  const parsed = parseWorkoutInput(fd);
  if (!parsed.ok) return { error: parsed.error };

  const { title, date, notes, exercises } = parsed.value;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workouts")
    .update({ title, workout_date: date, notes, exercises })
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) return { error: FAILED };
  refresh();
  return { ok: true };
}

export async function deleteWorkout(_prev: FitnessFormState, fd: FormData): Promise<FitnessFormState> {
  await getCurrentUser();
  const id = parseId(fd.get("id"));
  if (!id) return { error: "Entreno no válido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("workouts").delete().eq("id", id).select("id");
  if (error || data.length === 0) return { error: "No se ha podido borrar. Inténtalo de nuevo." };
  redirect("/fitness");
}

// Routines -------------------------------------------------------------------------

export async function createRoutine(_prev: FitnessFormState, fd: FormData): Promise<FitnessFormState> {
  await getCurrentUser();
  const parsed = parseRoutineInput(fd);
  if (!parsed.ok) return { error: parsed.error };
  const supabase = await createClient();
  const { data, error } = await supabase.from("workout_routines").insert(parsed.value).select("id").single();
  if (error) return { error: FAILED };
  redirect(`/fitness/rutinas/${data.id}`);
}

/** Saves the exercises of a workout as a new routine. */
export async function routineFromWorkout(_prev: FitnessFormState, fd: FormData): Promise<FitnessFormState> {
  await getCurrentUser();
  const parsed = parseRoutineInput(fd);
  if (!parsed.ok) return { error: parsed.error };
  const supabase = await createClient();
  // Template, not log: keep the sets but no notes from that day.
  const { error } = await supabase.from("workout_routines").insert({ ...parsed.value, notes: null });
  if (error) return { error: FAILED };
  refresh();
  return { ok: true };
}

export async function saveRoutine(_prev: FitnessFormState, fd: FormData): Promise<FitnessFormState> {
  await getCurrentUser();
  const id = parseId(fd.get("id"));
  if (!id) return { error: "Rutina no válida." };
  const parsed = parseRoutineInput(fd);
  if (!parsed.ok) return { error: parsed.error };
  const supabase = await createClient();
  const { data, error } = await supabase.from("workout_routines").update(parsed.value).eq("id", id).select("id");
  if (error || data.length === 0) return { error: FAILED };
  refresh();
  return { ok: true };
}

export async function deleteRoutine(_prev: FitnessFormState, fd: FormData): Promise<FitnessFormState> {
  await getCurrentUser();
  const id = parseId(fd.get("id"));
  if (!id) return { error: "Rutina no válida." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("workout_routines").delete().eq("id", id).select("id");
  if (error || data.length === 0) return { error: "No se ha podido borrar. Inténtalo de nuevo." };
  redirect("/fitness");
}

// Body weight ----------------------------------------------------------------------

/** One weigh-in per day: logging again the same day replaces it. */
export async function logBodyWeight(_prev: FitnessFormState, fd: FormData): Promise<FitnessFormState> {
  const user = await getCurrentUser();
  const parsed = parseBodyWeightInput(fd);
  if (!parsed.ok) return { error: parsed.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("body_weights")
    .upsert(
      { user_id: user.id, measured_on: parsed.value.date, weight_kg: parsed.value.weightKg },
      { onConflict: "user_id,measured_on" },
    );
  if (error) return { error: FAILED };
  refresh();
  return { ok: true };
}

export async function deleteBodyWeight(id: string): Promise<{ ok: boolean; row?: { date: string; weightKg: number } }> {
  await getCurrentUser();
  const safeId = parseId(id);
  if (!safeId) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.from("body_weights").delete().eq("id", safeId).select("measured_on,weight_kg");
  if (error || !data?.length) return { ok: false };
  refresh();
  return { ok: true, row: { date: data[0].measured_on, weightKg: Number(data[0].weight_kg) } };
}

/** Undo for deleteBodyWeight. */
export async function restoreBodyWeight(row: { date: string; weightKg: number }): Promise<void> {
  const fd = new FormData();
  fd.set("date", row.date);
  fd.set("weight", String(row.weightKg));
  await logBodyWeight({}, fd);
}

// Muscle groups ----------------------------------------------------------------------

/** Saves which muscles an exercise trains: `primary` plus optional `secondary` (repeated field). */
export async function setExerciseMuscles(_prev: FitnessFormState, fd: FormData): Promise<FitnessFormState> {
  const user = await getCurrentUser();
  const name = String(fd.get("exercise") ?? "").trim();
  const key = exerciseKey(name);
  const primary = fd.get("primary");
  if (!key) return { error: "Ejercicio no válido." };
  if (!isMuscle(primary)) return { error: "Elige el músculo principal." };
  const secondary = fd.getAll("secondary").filter(isMuscle).filter((m) => m !== primary);
  if (secondary.length > 3) return { error: "Como mucho 3 músculos secundarios." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("exercise_muscles")
    .upsert({ user_id: user.id, exercise_key: key, muscles: [primary, ...secondary] }, { onConflict: "user_id,exercise_key" });
  if (error) return { error: FAILED };
  refresh();
  return { ok: true };
}

/** Back to the app's own guess for that exercise. */
export async function resetExerciseMuscles(_prev: FitnessFormState, fd: FormData): Promise<FitnessFormState> {
  await getCurrentUser();
  const key = exerciseKey(String(fd.get("exercise") ?? ""));
  if (!key) return { error: "Ejercicio no válido." };
  const supabase = await createClient();
  const { error } = await supabase.from("exercise_muscles").delete().eq("exercise_key", key);
  if (error) return { error: FAILED };
  refresh();
  return { ok: true };
}

// Jax as coach -----------------------------------------------------------------------

const COACH_COOLDOWN_MS = 10 * 60_000;

/** Asks Jax for an analysis of the last weeks and stores it. */
export async function askCoach(): Promise<FitnessFormState> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("coach_notes")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last && Date.now() - Date.parse(last.created_at) < COACH_COOLDOWN_MS) {
    return { error: "Jax acaba de analizar tu entrenamiento. Vuelve a pedírselo en unos minutos." };
  }

  const [workouts, weights, overrides] = await Promise.all([listWorkouts(), listBodyWeights(), listMuscleOverrides()]);
  if (!workouts.some((w) => w.exercises.some((e) => e.sets.length))) {
    return { error: "Apunta algún entreno primero: Jax necesita datos para analizarlos." };
  }
  let answer: CoachAnswer | null;
  try {
    const raw = await generateJson<unknown>({
      system: COACH_SYSTEM,
      prompt: `<DATOS>\n${coachData(workouts, weights, overrides, todayIn(new Date()))}\n</DATOS>`,
      schema: COACH_SCHEMA,
    });
    answer = cleanCoachAnswer(raw);
  } catch (err) {
    const limit = err instanceof ProviderError && err.kind === "rate_limit";
    return { error: limit ? "Jax ha llegado a su límite de uso por hoy. Inténtalo más tarde." : "Jax no ha podido analizarlo ahora. Inténtalo de nuevo." };
  }
  if (!answer) return { error: "Jax no ha podido analizarlo ahora. Inténtalo de nuevo." };

  const { error } = await supabase.from("coach_notes").insert({ summary: answer.summary, tips: answer.tips });
  if (error) return { error: FAILED };
  refresh();
  return { ok: true };
}
