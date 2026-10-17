"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/tasks/dates";
import { parseTaskId as parseId } from "@/lib/tasks/validation";
import { gameState, rewardBetween, type Reward } from "@/lib/fitness/game";
import { listBodyWeights, listRoutines, listWorkouts } from "@/lib/fitness/queries";
import { asExercises } from "@/lib/fitness/types";
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

export async function saveWorkout(_prev: FitnessFormState, fd: FormData): Promise<FitnessFormState & { reward?: Reward }> {
  await getCurrentUser();
  const id = parseId(fd.get("id"));
  if (!id) return { error: "Entreno no válido." };
  const parsed = parseWorkoutInput(fd);
  if (!parsed.ok) return { error: parsed.error };

  const { title, date, notes, exercises } = parsed.value;
  const supabase = await createClient();
  // The game state before and after this save tells what it earned.
  const [workouts, weights, routines] = await Promise.all([listWorkouts(), listBodyWeights(), listRoutines()]);
  const { data, error } = await supabase
    .from("workouts")
    .update({ title, workout_date: date, notes, exercises })
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) return { error: FAILED };

  const today = todayIn(new Date());
  const before = gameState(workouts, weights, routines.length, today);
  const updated = workouts.map((w) => (w.id === id ? { ...w, title, date, notes, exercises } : w));
  const after = gameState(updated, weights, routines.length, today);
  refresh();
  return { ok: true, reward: rewardBetween(before, after, id) };
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
