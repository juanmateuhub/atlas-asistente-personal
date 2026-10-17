import "server-only";
import { getCurrentUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { isMuscle, type MuscleMap } from "./muscles";
import { ROUTINE_COLUMNS, WORKOUT_COLUMNS, toRoutine, toWorkout, type BodyWeight, type Routine, type Workout } from "./types";

/** The user's workouts, newest first. Enough history for records and "last time". */
export async function listWorkouts(limit = 200): Promise<Workout[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workouts")
    .select(WORKOUT_COLUMNS)
    .order("workout_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("No se han podido cargar los entrenos.");
  return data.map(toWorkout);
}

export async function listRoutines(): Promise<Routine[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("workout_routines").select(ROUTINE_COLUMNS).order("name").limit(100);
  if (error) throw new Error("No se han podido cargar las rutinas.");
  return data.map(toRoutine);
}

export async function getRoutine(id: string): Promise<Routine | null> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("workout_routines").select(ROUTINE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error("No se ha podido cargar la rutina.");
  return data ? toRoutine(data) : null;
}

/** Weigh-ins, newest first. */
export async function listBodyWeights(limit = 120): Promise<BodyWeight[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_weights")
    .select("id,measured_on,weight_kg")
    .order("measured_on", { ascending: false })
    .limit(limit);
  if (error) throw new Error("No se ha podido cargar tu peso.");
  return data.map((r) => ({ id: r.id, date: r.measured_on, weightKg: Number(r.weight_kg) }));
}

/** The user's own exercise → muscles mapping, by exercise key. */
export async function listMuscleOverrides(): Promise<Record<string, MuscleMap>> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("exercise_muscles").select("exercise_key,muscles").limit(500);
  if (error) throw new Error("No se han podido cargar los grupos musculares.");
  return Object.fromEntries(data.map((r) => [r.exercise_key, (r.muscles as string[]).filter(isMuscle)]));
}

export type CoachNote = { summary: string; tips: string[]; createdAt: string };

export async function latestCoachNote(): Promise<CoachNote | null> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("coach_notes")
    .select("summary,tips,created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const tips = Array.isArray(data.tips) ? data.tips.filter((t: unknown): t is string => typeof t === "string") : [];
  return { summary: data.summary, tips, createdAt: data.created_at };
}
