/**
 * Fitness as an RPG. Everything here is derived from the logged data (workouts,
 * weigh-ins, routines): nothing is stored, so editing or deleting a workout
 * recalculates XP, level, stats, quests and achievements consistently.
 */
import { daysBetween } from "@/lib/tasks/dates";
import { estimateOneRepMax, volume } from "./stats";
import type { BodyWeight, Exercise, Workout } from "./types";

// --- XP rules ------------------------------------------------------------------------

export const XP = {
  workout: 20,
  perSet: 2,
  /** Per 250 kg moved in a session. */
  perVolume: 1,
  record: 25,
  weighIn: 5,
} as const;

/** Weekly quests; the same rules give their XP for every past week too. */
export const QUESTS = [
  { id: "entrenos", title: "Entrena 3 días esta semana", goal: 3, xp: 50 },
  { id: "record", title: "Bate un récord", goal: 1, xp: 30 },
  { id: "peso", title: "Apunta tu peso", goal: 1, xp: 15 },
] as const;

export type QuestId = (typeof QUESTS)[number]["id"];

const key = (name: string) => name.trim().toLocaleLowerCase("es");

/** Monday of the week of `date` (`YYYY-MM-DD`). */
export function weekOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const offset = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - offset);
  return t.toISOString().slice(0, 10);
}

const addDays = (date: string, days: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

const doneSets = (exercises: Exercise[]) => exercises.reduce((n, e) => n + e.sets.filter((s) => s.reps > 0).length, 0);

// --- Levels --------------------------------------------------------------------------

/** XP needed to go from `level` to the next one. */
export const xpToNext = (level: number) => 100 + 40 * (level - 1);

export const TITLES = [
  { from: 1, title: "Novato" },
  { from: 3, title: "Aprendiz" },
  { from: 6, title: "Escudero" },
  { from: 10, title: "Guerrero" },
  { from: 15, title: "Veterano" },
  { from: 21, title: "Campeón" },
  { from: 30, title: "Leyenda" },
] as const;

export function titleFor(level: number): string {
  return TITLES.findLast((t) => level >= t.from)!.title;
}

export type Level = { level: number; title: string; xp: number; into: number; needed: number };

export function levelFor(totalXp: number): Level {
  let level = 1;
  let rest = Math.max(0, Math.floor(totalXp));
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level += 1;
  }
  return { level, title: titleFor(level), xp: Math.floor(totalXp), into: rest, needed: xpToNext(level) };
}

// --- Per-workout XP and records --------------------------------------------------------

export type WorkoutXp = { id: string; date: string; xp: number; records: string[] };

/**
 * XP of each workout, oldest first, and the records it set. A record is a set
 * heavier than any earlier set of that exercise; the first time doesn't count.
 */
export function scoreWorkouts(workouts: Workout[]): WorkoutXp[] {
  const best = new Map<string, number>();
  const ordered = workouts.toSorted((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return ordered.map((w) => {
    const records: string[] = [];
    for (const e of w.exercises) {
      const top = Math.max(0, ...e.sets.filter((s) => s.reps > 0).map((s) => s.weight ?? 0));
      if (top <= 0) continue;
      const prev = best.get(key(e.name));
      if (prev !== undefined && top > prev) records.push(e.name);
      if (prev === undefined || top > prev) best.set(key(e.name), top);
    }
    const sets = doneSets(w.exercises);
    // An empty workout (just started) is worth nothing yet.
    const xp =
      sets === 0
        ? 0
        : XP.workout + sets * XP.perSet + Math.floor(volume(w.exercises) / 250) * XP.perVolume + records.length * XP.record;
    return { id: w.id, date: w.date, xp, records };
  });
}

// --- Quests ------------------------------------------------------------------------

export type Quest = { id: QuestId; title: string; goal: number; xp: number; progress: number; done: boolean };

function questProgress(week: string, scored: WorkoutXp[], weights: BodyWeight[]): Record<QuestId, number> {
  const inWeek = (d: string) => weekOf(d) === week;
  const ws = scored.filter((w) => w.xp > 0 && inWeek(w.date));
  return {
    // Days, not sessions: three workouts on one day are one day of training.
    entrenos: new Set(ws.map((w) => w.date)).size,
    record: ws.reduce((n, w) => n + w.records.length, 0),
    peso: weights.filter((w) => inWeek(w.date)).length,
  };
}

function questsFor(week: string, scored: WorkoutXp[], weights: BodyWeight[]): Quest[] {
  const progress = questProgress(week, scored, weights);
  return QUESTS.map((q) => ({ ...q, progress: Math.min(progress[q.id], q.goal), done: progress[q.id] >= q.goal }));
}

// --- Stats -------------------------------------------------------------------------

export type Stats = { fuerza: number; resistencia: number; constancia: number };

const clamp = (n: number) => Math.max(0, Math.min(99, Math.round(n)));

/**
 * 0–99 each. Fuerza: the three best estimated 1RMs (relative to body weight
 * when known). Resistencia: reps in the last 28 days. Constancia: training days in
 * the last 28 days.
 */
export function statsFor(workouts: Workout[], weights: BodyWeight[], today: string): Stats {
  const oneRm = new Map<string, number>();
  for (const w of workouts) {
    for (const e of w.exercises) {
      for (const s of e.sets) {
        if (!s.weight || s.reps <= 0) continue;
        const rm = estimateOneRepMax(s.weight, Math.min(s.reps, 12));
        oneRm.set(key(e.name), Math.max(oneRm.get(key(e.name)) ?? 0, rm));
      }
    }
  }
  const top3 = [...oneRm.values()].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
  const bodyweight = weights[0]?.weightKg;
  const fuerza = bodyweight ? (top3 / bodyweight) * 18 : top3 / 4;

  const recent = workouts.filter((w) => {
    const ago = daysBetween(w.date, today);
    return ago >= 0 && ago < 28;
  });
  const reps = recent.reduce((n, w) => n + w.exercises.reduce((m, e) => m + e.sets.reduce((k, s) => k + s.reps, 0), 0), 0);
  const sessions = new Set(recent.filter((w) => doneSets(w.exercises) > 0).map((w) => w.date)).size;
  return { fuerza: clamp(fuerza), resistencia: clamp(reps / 10), constancia: clamp(sessions * 8) };
}

// --- Streak ------------------------------------------------------------------------

/** Weeks in a row with at least one workout. This week counts once trained; until then the streak is still alive. */
export function weekStreak(workouts: Workout[], today: string): number {
  const weeks = new Set(workouts.filter((w) => doneSets(w.exercises) > 0).map((w) => weekOf(w.date)));
  let week = weekOf(today);
  if (!weeks.has(week)) week = addDays(week, -7);
  let streak = 0;
  while (weeks.has(week)) {
    streak += 1;
    week = addDays(week, -7);
  }
  return streak;
}

function bestStreak(workouts: Workout[]): number {
  const weeks = [...new Set(workouts.filter((w) => doneSets(w.exercises) > 0).map((w) => weekOf(w.date)))].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const w of weeks) {
    run = prev && addDays(prev, 7) === w ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  return best;
}

// --- Achievements ------------------------------------------------------------------

export type Achievement = { id: string; title: string; description: string; unlocked: boolean };

function achievementsFor(workouts: Workout[], weights: BodyWeight[], routines: number, scored: WorkoutXp[]): Achievement[] {
  const done = workouts.filter((w) => doneSets(w.exercises) > 0);
  const heaviest = Math.max(0, ...done.flatMap((w) => w.exercises.flatMap((e) => e.sets.map((s) => (s.reps > 0 ? (s.weight ?? 0) : 0)))));
  const biggest = Math.max(0, ...done.map((w) => volume(w.exercises)));
  const records = scored.reduce((n, w) => n + w.records.length, 0);
  const streak = bestStreak(workouts);
  const list: [string, string, string, boolean][] = [
    ["primer-entreno", "Primera sangre", "Completa tu primer entreno", done.length >= 1],
    ["diez", "Habitual", "10 entrenos completados", done.length >= 10],
    ["cincuenta", "Veterano del hierro", "50 entrenos completados", done.length >= 50],
    ["cien", "Centurión", "100 entrenos completados", done.length >= 100],
    ["record", "Rompemarcas", "Bate tu primer récord", records >= 1],
    ["diez-records", "Imparable", "Bate 10 récords", records >= 10],
    ["club-100", "Club de los 100", "Levanta 100 kg en una serie", heaviest >= 100],
    ["toneladas", "Mueve montañas", "5.000 kg en un solo entreno", biggest >= 5000],
    ["racha-4", "Llama viva", "4 semanas seguidas entrenando", streak >= 4],
    ["racha-12", "Voluntad de hierro", "12 semanas seguidas entrenando", streak >= 12],
    ["estratega", "Estratega", "Crea tu primera rutina", routines >= 1],
    ["bascula", "Autoconocimiento", "Apunta tu peso 7 veces", weights.length >= 7],
  ];
  return list.map(([id, title, description, unlocked]) => ({ id, title, description, unlocked }));
}

// --- Everything together -------------------------------------------------------------

export type GameState = {
  level: Level;
  stats: Stats;
  streak: number;
  quests: Quest[];
  achievements: Achievement[];
  /** By workout id. */
  workoutXp: Record<string, WorkoutXp>;
};

export function gameState(workouts: Workout[], weights: BodyWeight[], routines: number, today: string): GameState {
  const scored = scoreWorkouts(workouts);
  const weeks = new Set([...scored.filter((w) => w.xp > 0).map((w) => weekOf(w.date)), ...weights.map((w) => weekOf(w.date))]);
  const questXp = [...weeks].reduce(
    (sum, week) => sum + questsFor(week, scored, weights).reduce((s, q) => s + (q.done ? q.xp : 0), 0),
    0,
  );
  const total = scored.reduce((s, w) => s + w.xp, 0) + weights.length * XP.weighIn + questXp;
  return {
    level: levelFor(total),
    stats: statsFor(workouts, weights, today),
    streak: weekStreak(workouts, today),
    quests: questsFor(weekOf(today), scored, weights),
    achievements: achievementsFor(workouts, weights, routines, scored),
    workoutXp: Object.fromEntries(scored.map((w) => [w.id, w])),
  };
}

/** What a save earned: XP difference, new records, level reached and achievements unlocked. */
export type Reward = { xp: number; records: string[]; levelUp: Level | null; achievements: string[] };

export function rewardBetween(before: GameState, after: GameState, workoutId: string): Reward {
  const prevRecords = new Set(before.workoutXp[workoutId]?.records ?? []);
  const unlockedBefore = new Set(before.achievements.filter((a) => a.unlocked).map((a) => a.id));
  return {
    xp: after.level.xp - before.level.xp,
    records: (after.workoutXp[workoutId]?.records ?? []).filter((r) => !prevRecords.has(r)),
    levelUp: after.level.level > before.level.level ? after.level : null,
    achievements: after.achievements.filter((a) => a.unlocked && !unlockedBefore.has(a.id)).map((a) => a.title),
  };
}

// --- Exercise history (record chart) ------------------------------------------------

export type ExercisePoint = { date: string; weight: number; reps: number; oneRepMax: number };

/** Heaviest set of an exercise on each day, oldest first (two sessions the same day count as one). */
export function exerciseHistory(workouts: Workout[], name: string): ExercisePoint[] {
  const byDay = new Map<string, ExercisePoint>();
  for (const w of workouts.toSorted((a, b) => a.date.localeCompare(b.date))) {
    for (const e of w.exercises) {
      if (key(e.name) !== key(name)) continue;
      const sets = e.sets.filter((s) => s.reps > 0 && s.weight !== null && s.weight > 0);
      if (!sets.length) continue;
      const top = sets.reduce((a, b) => ((b.weight as number) > (a.weight as number) || (b.weight === a.weight && b.reps > a.reps) ? b : a));
      const rm = Math.round(Math.max(...sets.map((s) => estimateOneRepMax(s.weight as number, s.reps))) * 2) / 2;
      const prev = byDay.get(w.date);
      const point = { date: w.date, weight: top.weight as number, reps: top.reps, oneRepMax: rm };
      if (!prev) byDay.set(w.date, point);
      else if (point.weight > prev.weight || (point.weight === prev.weight && point.reps > prev.reps)) {
        byDay.set(w.date, { ...point, oneRepMax: Math.max(rm, prev.oneRepMax) });
      } else prev.oneRepMax = Math.max(rm, prev.oneRepMax);
    }
  }
  return [...byDay.values()];
}
