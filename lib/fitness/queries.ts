import "server-only";
import { getCurrentUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
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
