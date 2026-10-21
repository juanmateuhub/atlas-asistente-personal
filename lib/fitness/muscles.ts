/**
 * Muscle groups: which ones each exercise trains, weekly volume per group and
 * Jax's load suggestions. The built-in dictionary guesses common Spanish (and
 * English) exercise names; the user's own mapping (exercise_muscles) wins.
 */
import { daysBetween } from "@/lib/tasks/dates";
import { loadFactor, type Workout, type WorkoutSet } from "./types";

export const MUSCLES = [
  { id: "pecho", label: "Pecho" },
  { id: "espalda", label: "Espalda" },
  { id: "trapecio", label: "Trapecio" },
  { id: "hombros", label: "Hombros" },
  { id: "biceps", label: "Bíceps" },
  { id: "triceps", label: "Tríceps" },
  { id: "antebrazos", label: "Antebrazos" },
  { id: "abdomen", label: "Abdomen" },
  { id: "lumbares", label: "Lumbares" },
  { id: "gluteos", label: "Glúteos" },
  { id: "cuadriceps", label: "Cuádriceps" },
  { id: "isquios", label: "Isquiotibiales" },
  { id: "gemelos", label: "Gemelos" },
] as const;

export type MuscleId = (typeof MUSCLES)[number]["id"];

export const MUSCLE_IDS = MUSCLES.map((m) => m.id) as MuscleId[];
export const muscleLabel = (id: MuscleId) => MUSCLES.find((m) => m.id === id)!.label;
export const isMuscle = (v: unknown): v is MuscleId => typeof v === "string" && (MUSCLE_IDS as string[]).includes(v);

/** Primary group first; the rest count half. */
export type MuscleMap = MuscleId[];

/** Lower case, no accents, single spaces: how exercise names are compared and stored. */
export function exerciseKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/** Checked in order: specific patterns before generic ones ("curl femoral" before "curl"). */
const DICTIONARY: [RegExp, MuscleMap][] = [
  [/curl (femoral|de pierna|isquio)|leg curl|femoral|isquio|good morning|nordic/, ["isquios", "gluteos"]],
  [/peso muerto rumano|rumano|rdl|stiff/, ["isquios", "gluteos", "lumbares"]],
  [/peso muerto|deadlift/, ["gluteos", "isquios", "lumbares", "trapecio"]],
  [/hip thrust|puente de gluteo|glute bridge|patada de gluteo|abduc|gluteo/, ["gluteos", "isquios"]],
  [/sentadilla|squat|prensa|leg press|zancada|lunge|bulgara|hack|step ?up/, ["cuadriceps", "gluteos"]],
  [/extension(es)? de (cuadriceps|pierna)|leg extension|cuadriceps/, ["cuadriceps"]],
  [/gemelo|pantorrilla|calf|elevacion(es)? de talon/, ["gemelos"]],
  [/press (militar|de hombro|hombro|arnold)|overhead|ohp|military|arnold/, ["hombros", "triceps"]],
  [/face ?pull|pajaro|reverse fly|posterior/, ["hombros", "trapecio"]],
  [/elevacion(es)? (lateral|frontal)|lateral raise|front raise|hombro/, ["hombros"]],
  [/encogimiento|shrug|trapecio/, ["trapecio"]],
  [/press (frances|cerrado)|skull|extension(es)? de triceps|triceps|fondos en banco|patada de triceps|pushdown|jalon de triceps/, ["triceps"]],
  [/dominada|pull ?up|chin ?up|jalon|pulldown|pullover/, ["espalda", "biceps"]],
  [/remo|row/, ["espalda", "biceps", "trapecio"]],
  [/fondos|dips/, ["pecho", "triceps", "hombros"]],
  [/press (banca|inclinado|declinado|de pecho|pecho)|bench|chest press|flexion|push ?up/, ["pecho", "triceps", "hombros"]],
  [/apertura|cruce|crossover|pec ?deck|contractora|fly|pecho/, ["pecho"]],
  [/martillo|hammer/, ["biceps", "antebrazos"]],
  [/curl|biceps|predicador/, ["biceps"]],
  [/antebrazo|muneca|wrist|farmer|paseo del granjero/, ["antebrazos"]],
  [/hiperextension|extension lumbar|superman|lumbar/, ["lumbares", "gluteos"]],
  [/abdominal|crunch|plancha|plank|rueda|ab wheel|elevacion(es)? de piernas|russian|oblicuo|abdomen|core/, ["abdomen"]],
  [/espalda/, ["espalda"]],
];

export function guessMuscles(name: string): MuscleMap | null {
  const key = exerciseKey(name);
  for (const [pattern, muscles] of DICTIONARY) if (pattern.test(key)) return muscles;
  return null;
}

/** The user's mapping (by exercise key) wins over the dictionary. */
export function musclesFor(name: string, overrides: Record<string, MuscleMap>): MuscleMap | null {
  return overrides[exerciseKey(name)] ?? guessMuscles(name);
}

// --- Weekly volume -------------------------------------------------------------------

export type MuscleVolume = {
  id: MuscleId;
  label: string;
  /** Hard sets per week: a set counts 1 for the primary group and 0.5 for the others. */
  sets: number;
  /** kg moved (reps × load), split the same way. */
  kg: number;
  /** Exercises that trained it, most sets first. */
  exercises: { name: string; sets: number }[];
};

export type VolumeReport = {
  muscles: MuscleVolume[];
  /** Exercises trained in the period that have no muscle group yet. */
  unknown: string[];
};

/**
 * Volume per muscle over the `days` days ending today, as a weekly figure
 * (divided by the number of weeks when the period is longer than one).
 */
export function muscleVolume(workouts: Workout[], overrides: Record<string, MuscleMap>, today: string, days = 7): VolumeReport {
  const totals = new Map<MuscleId, { sets: number; kg: number; exercises: Map<string, { name: string; sets: number }> }>(
    MUSCLE_IDS.map((id) => [id, { sets: 0, kg: 0, exercises: new Map() }]),
  );
  const unknown = new Map<string, string>();
  const weeks = days / 7;
  for (const w of workouts) {
    const ago = daysBetween(w.date, today);
    if (ago < 0 || ago >= days) continue;
    for (const e of w.exercises) {
      const sets = e.sets.filter((s) => s.reps > 0);
      if (!sets.length) continue;
      const map = musclesFor(e.name, overrides);
      if (!map) {
        unknown.set(exerciseKey(e.name), e.name);
        continue;
      }
      const kg = loadFactor(e) * sets.reduce((sum, s) => sum + s.reps * (s.weight ?? 0), 0);
      map.forEach((id, i) => {
        const share = i === 0 ? 1 : 0.5;
        const t = totals.get(id)!;
        t.sets += sets.length * share;
        t.kg += kg * share;
        const ex = t.exercises.get(exerciseKey(e.name)) ?? { name: e.name, sets: 0 };
        ex.sets += sets.length * share;
        t.exercises.set(exerciseKey(e.name), ex);
      });
    }
  }
  return {
    muscles: MUSCLES.map((m) => {
      const t = totals.get(m.id)!;
      const round = (n: number) => Math.round((n / weeks) * 10) / 10;
      return {
        id: m.id,
        label: m.label,
        sets: round(t.sets),
        kg: Math.round(t.kg / weeks),
        exercises: [...t.exercises.values()].map((x) => ({ name: x.name, sets: round(x.sets) })).sort((a, b) => b.sets - a.sets),
      };
    }),
    unknown: [...unknown.values()],
  };
}

/** Rough weekly guideline for hypertrophy (hard sets per muscle). Orientative, not a prescription. */
export const VOLUME_RANGE = { low: 10, high: 20 } as const;

export type VolumeLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** 0 none, 1–2 below the range, 3–4 inside it, 5 above. Drives the body's colour. */
export function volumeLevel(sets: number): VolumeLevel {
  if (sets <= 0) return 0;
  if (sets < 5) return 1;
  if (sets < VOLUME_RANGE.low) return 2;
  if (sets < 15) return 3;
  if (sets <= VOLUME_RANGE.high) return 4;
  return 5;
}

export function volumeStatus(sets: number): string {
  if (sets <= 0) return "Sin trabajar";
  if (sets < VOLUME_RANGE.low) return "Por debajo de lo recomendado";
  if (sets <= VOLUME_RANGE.high) return "En rango";
  return "Por encima de lo recomendado";
}

// --- Load suggestions (Jax as coach) ---------------------------------------------------

export type Suggestion = { sets: WorkoutSet[]; reason: string };

const LOWER_BODY: MuscleId[] = ["cuadriceps", "gluteos", "isquios", "lumbares"];

/**
 * Double progression from the last session of an exercise: every set completed
 * at the same load and reps → add weight (5 kg for big lower-body lifts, 2.5 kg
 * otherwise, 1 kg for light loads); reps dropped → keep the load and complete
 * them; bodyweight → one more rep per set.
 */
export function suggestNext(last: WorkoutSet[], muscles: MuscleMap | null): Suggestion | null {
  const sets = last.filter((s) => s.reps > 0);
  if (!sets.length) return null;
  const top = Math.max(...sets.map((s) => s.weight ?? 0));
  if (top === 0) {
    return {
      sets: sets.map((s) => ({ reps: s.reps + 1, weight: null })),
      reason: "Con tu peso: una repetición más por serie.",
    };
  }
  const working = sets.filter((s) => s.weight === top);
  const target = Math.max(...working.map((s) => s.reps));
  const completed = working.length === sets.length && working.every((s) => s.reps === target);
  if (completed) {
    const step = top < 20 ? 1 : muscles && LOWER_BODY.includes(muscles[0]) ? 5 : 2.5;
    return {
      sets: sets.map(() => ({ reps: target, weight: top + step })),
      reason: `Completaste todas las series: sube ${step.toString().replace(".", ",")} kg.`,
    };
  }
  return {
    sets: sets.map(() => ({ reps: target, weight: top })),
    reason: "Mismo peso: intenta completar todas las series.",
  };
}
