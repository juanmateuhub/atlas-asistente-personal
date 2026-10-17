import { describe, expect, it } from "vitest";
import { buildDataBlock, stripUnknownRefs } from "@/lib/jax/context";
import { emptyRefs, planAction, planUndo, toProposal, type RefMap } from "@/lib/jax/tools";
import { exerciseHistory, formatSets, lastPerformance, personalRecords, summarize, volume, weightTrend } from "@/lib/fitness/stats";
import { parseBodyWeightInput, parseExercises, parseWorkoutInput } from "@/lib/fitness/validation";
import type { Workout } from "@/lib/fitness/types";

const ID = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;

function form(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("parseExercises", () => {
  it("cleans names, accepts decimal commas and bodyweight sets", () => {
    const r = parseExercises(
      JSON.stringify([
        { name: "  press   banca ", sets: [{ reps: "8", weight: "62,5" }, { reps: 6, weight: 65.1 }] },
        { name: "Dominadas", sets: [{ reps: "10", weight: "" }] },
      ]),
    );
    expect(r).toEqual({
      ok: true,
      value: [
        { name: "Press banca", sets: [{ reps: 8, weight: 62.5 }, { reps: 6, weight: 65 }] },
        { name: "Dominadas", sets: [{ reps: 10, weight: null }] },
      ],
    });
  });

  it("drops empty rows and rejects bad numbers", () => {
    expect(parseExercises([{ name: "", sets: [] }])).toEqual({ ok: true, value: [] });
    expect(parseExercises([{ name: "", sets: [{ reps: 5 }] }]).ok).toBe(false);
    expect(parseExercises([{ name: "Remo", sets: [{ reps: 2.5, weight: 40 }] }]).ok).toBe(false);
    expect(parseExercises([{ name: "Remo", sets: [{ reps: 8, weight: "-3" }] }]).ok).toBe(false);
    expect(parseExercises("{nope").ok).toBe(false);
    expect(parseExercises({ name: "x" }).ok).toBe(false);
  });

  it("validates the workout form and body weight", () => {
    expect(parseWorkoutInput(form({ title: "Pierna", date: "2026-10-17", exercises: "[]" })).ok).toBe(true);
    expect(parseWorkoutInput(form({ title: "", date: "2026-10-17" })).ok).toBe(false);
    expect(parseWorkoutInput(form({ title: "Pierna", date: "2026-02-30" })).ok).toBe(false);
    expect(parseBodyWeightInput(form({ date: "2026-10-17", weight: "72,35" }))).toEqual({
      ok: true,
      value: { date: "2026-10-17", weightKg: 72.35 },
    });
    expect(parseBodyWeightInput(form({ date: "2026-10-17", weight: "7" })).ok).toBe(false);
  });
});

const workouts: Workout[] = [
  {
    id: ID(2),
    title: "Torso",
    date: "2026-10-16",
    notes: null,
    exercises: [{ name: "Press banca", sets: [{ reps: 5, weight: 70 }, { reps: 8, weight: 60 }] }],
  },
  {
    id: ID(1),
    title: "Torso",
    date: "2026-10-13",
    notes: null,
    exercises: [
      { name: "press banca", sets: [{ reps: 8, weight: 60 }, { reps: 8, weight: 60 }] },
      { name: "Dominadas", sets: [{ reps: 10, weight: null }] },
    ],
  },
];

describe("stats", () => {
  it("formats sets compactly", () => {
    expect(formatSets([{ reps: 8, weight: 60 }, { reps: 8, weight: 60 }, { reps: 8, weight: 60 }])).toBe("3 × 8 · 60 kg");
    expect(formatSets([{ reps: 8, weight: 60 }, { reps: 6, weight: 62.5 }])).toBe("8 × 60, 6 × 62,5 kg");
    expect(formatSets([{ reps: 10, weight: null }, { reps: 8, weight: null }])).toBe("10, 8 reps");
    expect(formatSets([])).toBe("Sin series");
  });

  it("sums volume and describes a workout", () => {
    expect(volume(workouts[1].exercises)).toBe(960);
    expect(summarize(workouts[1].exercises)).toBe("2 ejercicios · 3 series");
  });

  it("finds the last time of each exercise, case-insensitively", () => {
    const last = lastPerformance(workouts, ID(2));
    expect(last["press banca"].date).toBe("2026-10-13");
    expect(lastPerformance(workouts)["press banca"].date).toBe("2026-10-16");
  });

  it("keeps the heaviest set per weighted exercise", () => {
    const records = personalRecords(workouts);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ name: "Press banca", weight: 70, reps: 5, sessions: 2 });
  });

  it("charts the heaviest set per day, oldest first", () => {
    const sameDay: Workout = { ...workouts[0], id: ID(5), exercises: [{ name: "Press banca", sets: [{ reps: 3, weight: 72.5 }] }] };
    expect(exerciseHistory([...workouts, sameDay], "PRESS BANCA")).toEqual([
      { date: "2026-10-13", weight: 60, reps: 8, oneRepMax: 76 },
      { date: "2026-10-16", weight: 72.5, reps: 3, oneRepMax: 81.5 },
    ]);
    expect(exerciseHistory(workouts, "Dominadas")).toEqual([]);
  });

  it("compares weight against about a month earlier", () => {
    const trend = weightTrend([
      { id: "a", date: "2026-10-17", weightKg: 72 },
      { id: "b", date: "2026-10-01", weightKg: 73 },
      { id: "c", date: "2026-09-10", weightKg: 74.5 },
    ]);
    expect(trend).toMatchObject({ change: -2.5, since: "2026-09-10" });
    expect(weightTrend([])).toBeNull();
  });
});

function refs(): RefMap {
  const r = emptyRefs();
  r.w.set("w1", {
    id: ID(3),
    label: "Torso",
    values: { title: "Torso", workout_date: "2026-10-17", exercises: JSON.stringify(workouts[0].exercises) },
  });
  r.bw.set("bw1", { id: ID(4), label: "72 kg", values: { measured_on: "2026-10-17", weight_kg: 72 } });
  return r;
}

describe("Jax fitness tools", () => {
  it("creates a workout from shorthand sets", () => {
    const r = toProposal(
      "apuntar_entreno",
      { date: "2026-10-18", title: "Pierna", exercises: [{ name: "sentadilla", sets: 3, reps: 8, weight_kg: 80 }] },
      refs(),
    );
    expect(r).toMatchObject({
      ok: true,
      proposal: {
        kind: "workout.create",
        payload: {
          values: {
            title: "Pierna",
            workout_date: "2026-10-18",
            exercises: [{ name: "Sentadilla", sets: [{ reps: 8, weight: 80 }, { reps: 8, weight: 80 }, { reps: 8, weight: 80 }] }],
          },
        },
      },
    });
    if (r.ok) expect(r.proposal.summary).toBe("Apuntar entreno «Pierna» el 18 oct: Sentadilla 3 × 8 · 80 kg");
  });

  it("appends to that day's workout, merging the same exercise", () => {
    const r = toProposal(
      "apuntar_entreno",
      { date: "2026-10-17", exercises: [{ name: "Press banca", sets: 1, reps: 3, weight_kg: 75 }, { name: "Fondos", sets: 2, reps: 12 }] },
      refs(),
    );
    expect(r).toMatchObject({ ok: true, proposal: { kind: "workout.update", payload: { id: ID(3) } } });
    if (!r.ok) return;
    expect(r.proposal.payload.changes).toEqual({
      exercises: [
        { name: "Press banca", sets: [{ reps: 5, weight: 70 }, { reps: 8, weight: 60 }, { reps: 3, weight: 75 }] },
        { name: "Fondos", sets: [{ reps: 12, weight: null }, { reps: 12, weight: null }] },
      ],
    });
    expect(planAction(r.proposal.kind, r.proposal.payload)).toMatchObject({ op: "update", table: "workouts", id: ID(3) });
  });

  it("rejects workouts without valid exercises", () => {
    expect(toProposal("apuntar_entreno", { date: "2026-10-18", exercises: [] }, refs()).ok).toBe(false);
    expect(toProposal("apuntar_entreno", { date: "2026-10-18", exercises: [{ name: "Curl", sets: 3, reps: -2 }] }, refs()).ok).toBe(false);
    expect(toProposal("apuntar_entreno", { date: "mañana", exercises: [{ name: "Curl", sets: 3, reps: 10 }] }, refs()).ok).toBe(false);
  });

  it("logs or changes body weight", () => {
    expect(toProposal("registrar_peso", { date: "2026-10-18", weight_kg: 71.8 }, refs())).toMatchObject({
      ok: true,
      proposal: { kind: "weight.create", payload: { values: { measured_on: "2026-10-18", weight_kg: 71.8 } } },
    });
    expect(toProposal("registrar_peso", { date: "2026-10-17", weight_kg: 71.5 }, refs())).toMatchObject({
      ok: true,
      proposal: { kind: "weight.update", payload: { id: ID(4), changes: { weight_kg: 71.5 } } },
    });
    expect(toProposal("registrar_peso", { date: "2026-10-17", weight_kg: 72 }, refs()).ok).toBe(false);
    expect(toProposal("registrar_peso", { date: "2026-10-17", weight_kg: 2 }, refs()).ok).toBe(false);
  });

  it("creates routines and deletes workouts by ref, with undo", () => {
    expect(
      toProposal("crear_rutina", { name: "Torso", exercises: [{ name: "Remo", sets: 4, reps: 10, weight_kg: 50 }] }, refs()),
    ).toMatchObject({ ok: true, proposal: { kind: "routine.create" } });
    const del = toProposal("borrar_entreno", { workout: "w1" }, refs());
    expect(del).toMatchObject({ ok: true, proposal: { kind: "workout.delete", payload: { id: ID(3) } } });
    expect(toProposal("borrar_entreno", { workout: "w9" }, refs()).ok).toBe(false);
    expect(planUndo("workout.delete", { row: { id: ID(3), title: "Torso", workout_date: "2026-10-17", exercises: [], user_id: ID(9) } })).toEqual({
      op: "insert",
      table: "workouts",
      values: { id: ID(3), title: "Torso", workout_date: "2026-10-17", exercises: [] },
    });
  });

  it("refuses columns the tools never write", () => {
    expect(planAction("workout.update", { id: ID(3), changes: { user_id: ID(9) } })).toBeNull();
    expect(planAction("weight.delete", { id: ID(4) })).toBeNull();
  });
});

describe("Jax data block", () => {
  it("lists workouts, routines and weights, and hides their refs from answers", () => {
    const block = buildDataBlock({
      today: "2026-10-17",
      now: "10:00",
      tasks: [],
      exams: [],
      events: [],
      subjects: [],
      reminders: [],
      memories: [],
      notes: [],
      workouts: [{ ref: "w1", title: "Torso", date: "2026-10-16", exercises: workouts[0].exercises }],
      routines: [{ name: "Pierna", exercises: [] }],
      weights: [{ ref: "bw1", date: "2026-10-17", weightKg: 72 }],
    });
    expect(block).toContain("- {w1} Torso | 2026-10-16 | Press banca 5 × 70, 8 × 60 kg");
    expect(block).toContain("- Pierna: sin ejercicios");
    expect(block).toContain("- {bw1} 2026-10-17 | 72 kg");
    expect(stripUnknownRefs("Hecho {w1} y [bw2].", [])).toBe("Hecho y.");
  });
});
