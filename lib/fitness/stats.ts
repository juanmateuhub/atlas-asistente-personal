import { daysBetween } from "@/lib/tasks/dates";
import type { BodyWeight, Exercise, Workout, WorkoutSet } from "./types";

const kgFmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

export const formatKg = (kg: number) => `${kgFmt.format(kg)} kg`;

const exerciseKey = (name: string) => name.trim().toLocaleLowerCase("es");

/** "3 × 8 · 60 kg" when every set is the same, otherwise "8 × 60, 8 × 60, 6 × 55 kg". */
export function formatSets(sets: WorkoutSet[]): string {
  if (sets.length === 0) return "Sin series";
  const first = sets[0];
  const same = sets.every((s) => s.reps === first.reps && s.weight === first.weight);
  if (same) {
    return `${sets.length} × ${first.reps}${first.weight !== null ? ` · ${formatKg(first.weight)}` : ""}`;
  }
  const allBodyweight = sets.every((s) => s.weight === null);
  if (allBodyweight) return sets.map((s) => s.reps).join(", ") + " reps";
  return sets.map((s) => (s.weight === null ? `${s.reps}` : `${s.reps} × ${kgFmt.format(s.weight)}`)).join(", ") + " kg";
}

/** Total kg moved (reps × load); bodyweight sets count zero. */
export function volume(exercises: Exercise[]): number {
  return exercises.reduce((sum, e) => sum + e.sets.reduce((s, set) => s + set.reps * (set.weight ?? 0), 0), 0);
}

export function countSets(exercises: Exercise[]): number {
  return exercises.reduce((n, e) => n + e.sets.length, 0);
}

export function summarize(exercises: Exercise[]): string {
  const n = exercises.length;
  const sets = countSets(exercises);
  if (n === 0) return "Sin ejercicios";
  return `${n} ${n === 1 ? "ejercicio" : "ejercicios"} · ${sets} ${sets === 1 ? "serie" : "series"}`;
}

/** What was done the last time for each exercise, from workouts newest first. */
export function lastPerformance(
  workouts: Workout[],
  excludeId?: string,
): Record<string, { date: string; sets: WorkoutSet[] }> {
  const out: Record<string, { date: string; sets: WorkoutSet[] }> = {};
  for (const w of workouts) {
    if (w.id === excludeId) continue;
    for (const e of w.exercises) {
      const key = exerciseKey(e.name);
      if (!(key in out) && e.sets.length > 0) out[key] = { date: w.date, sets: e.sets };
    }
  }
  return out;
}

export function performanceFor(map: Record<string, { date: string; sets: WorkoutSet[] }>, name: string) {
  return map[exerciseKey(name)] ?? null;
}

/** Epley's estimated one-rep max. */
export const estimateOneRepMax = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30));

export type PersonalRecord = {
  name: string;
  /** Heaviest set ever, and its reps. */
  weight: number;
  reps: number;
  date: string;
  oneRepMax: number;
  /** How many workouts include it, to show the usual ones first. */
  sessions: number;
};

/** Best set per weighted exercise, most trained first. */
export function personalRecords(workouts: Workout[], limit = 8): PersonalRecord[] {
  const byName = new Map<string, PersonalRecord>();
  for (const w of workouts) {
    for (const e of w.exercises) {
      const key = exerciseKey(e.name);
      const weighted = e.sets.filter((s) => s.weight !== null && s.weight > 0 && s.reps > 0);
      const record = byName.get(key);
      if (record) record.sessions += 1;
      for (const s of weighted) {
        const kg = s.weight as number;
        const current = byName.get(key);
        if (!current) {
          byName.set(key, { name: e.name, weight: kg, reps: s.reps, date: w.date, oneRepMax: estimateOneRepMax(kg, s.reps), sessions: 1 });
          continue;
        }
        if (kg > current.weight || (kg === current.weight && s.reps > current.reps)) {
          Object.assign(current, { weight: kg, reps: s.reps, date: w.date });
        }
        current.oneRepMax = Math.max(current.oneRepMax, estimateOneRepMax(kg, s.reps));
      }
    }
  }
  return [...byName.values()].sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, "es")).slice(0, limit);
}

/** Distinct exercise names, most recent first, for the editor's suggestions. */
export function exerciseNames(workouts: Workout[], routines: { exercises: Exercise[] }[] = []): string[] {
  const seen = new Map<string, string>();
  for (const e of [...workouts, ...routines].flatMap((w) => w.exercises)) {
    const key = exerciseKey(e.name);
    if (!seen.has(key)) seen.set(key, e.name);
  }
  return [...seen.values()];
}

export type WeightTrend = {
  latest: BodyWeight;
  /** Change against the closest weigh-in at least `days` earlier, or the oldest one. */
  change: number | null;
  since: string | null;
};

/** `weights` newest first. */
export function weightTrend(weights: BodyWeight[], days = 30): WeightTrend | null {
  const latest = weights[0];
  if (!latest) return null;
  const older = weights.slice(1);
  const base = older.find((w) => daysBetween(w.date, latest.date) >= days) ?? older.at(-1) ?? null;
  return {
    latest,
    change: base ? Math.round((latest.weightKg - base.weightKg) * 100) / 100 : null,
    since: base?.date ?? null,
  };
}
