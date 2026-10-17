import { describe, expect, it } from "vitest";
import { cleanCoachAnswer, coachData } from "@/lib/fitness/coach";
import { exerciseKey, guessMuscles, musclesFor, muscleVolume, suggestNext, volumeLevel } from "@/lib/fitness/muscles";
import type { Workout } from "@/lib/fitness/types";
import { emptyRefs, planAction, toProposal } from "@/lib/jax/tools";

const ID = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;

const w = (id: string, date: string, exercises: [string, [number, number | null][]][]): Workout => ({
  id,
  title: "Entreno",
  date,
  notes: null,
  exercises: exercises.map(([name, sets]) => ({ name, sets: sets.map(([reps, weight]) => ({ reps, weight })) })),
});

describe("guessMuscles", () => {
  it("knows common exercises, specific names first", () => {
    expect(guessMuscles("Press banca")).toEqual(["pecho", "triceps", "hombros"]);
    expect(guessMuscles("Curl femoral tumbado")).toEqual(["isquios", "gluteos"]);
    expect(guessMuscles("Curl de bíceps con barra")).toEqual(["biceps"]);
    expect(guessMuscles("Peso muerto rumano")?.[0]).toBe("isquios");
    expect(guessMuscles("Sentadilla búlgara")?.[0]).toBe("cuadriceps");
    expect(guessMuscles("Elevaciones laterales")).toEqual(["hombros"]);
    expect(guessMuscles("Jalón al pecho")?.[0]).toBe("espalda");
    expect(guessMuscles("Fondos en banco")).toEqual(["triceps"]);
    expect(guessMuscles("Cc")).toBeNull();
  });

  it("normalises names and lets the user's mapping win", () => {
    expect(exerciseKey("  Jalón   al PECHO ")).toBe("jalon al pecho");
    expect(musclesFor("Cc", { cc: ["biceps"] })).toEqual(["biceps"]);
    expect(musclesFor("Press banca", { "press banca": ["pecho"] })).toEqual(["pecho"]);
  });
});

describe("muscleVolume", () => {
  const workouts = [
    w("a", "2026-10-16", [
      ["Press banca", [[8, 60], [8, 60], [8, 60]]],
      ["Cc", [[10, 20]]],
    ]),
    w("b", "2026-10-01", [["Sentadilla", [[5, 100], [5, 100]]]]),
  ];

  it("counts primary sets fully and secondary ones by half, in the period", () => {
    const r = muscleVolume(workouts, {}, "2026-10-17", 7);
    const get = (id: string) => r.muscles.find((m) => m.id === id)!;
    expect(get("pecho")).toMatchObject({ sets: 3, kg: 1440, exercises: [{ name: "Press banca", sets: 3 }] });
    expect(get("triceps").sets).toBe(1.5);
    expect(get("cuadriceps").sets).toBe(0);
    expect(r.unknown).toEqual(["Cc"]);
  });

  it("averages longer periods per week", () => {
    const r = muscleVolume(workouts, { cc: ["biceps"] }, "2026-10-17", 28);
    expect(r.muscles.find((m) => m.id === "cuadriceps")!.sets).toBe(0.5);
    expect(r.unknown).toEqual([]);
  });

  it("maps sets to colour levels", () => {
    expect([0, 3, 7, 12, 18, 25].map(volumeLevel)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("suggestNext", () => {
  it("adds weight when every set was completed", () => {
    expect(suggestNext([{ reps: 8, weight: 60 }, { reps: 8, weight: 60 }], ["pecho"])).toMatchObject({
      sets: [{ reps: 8, weight: 62.5 }, { reps: 8, weight: 62.5 }],
    });
    expect(suggestNext([{ reps: 5, weight: 100 }], ["cuadriceps"])?.sets).toEqual([{ reps: 5, weight: 105 }]);
    expect(suggestNext([{ reps: 12, weight: 10 }], ["biceps"])?.sets).toEqual([{ reps: 12, weight: 11 }]);
  });

  it("keeps the load when reps dropped, and adds reps on bodyweight", () => {
    expect(suggestNext([{ reps: 8, weight: 60 }, { reps: 6, weight: 60 }], ["pecho"])?.sets).toEqual([
      { reps: 8, weight: 60 },
      { reps: 8, weight: 60 },
    ]);
    expect(suggestNext([{ reps: 10, weight: null }], null)?.sets).toEqual([{ reps: 11, weight: null }]);
    expect(suggestNext([], null)).toBeNull();
  });
});

describe("coach", () => {
  it("summarises training for the prompt", () => {
    const text = coachData([w("a", "2026-10-16", [["Press banca", [[8, 60]]]]), w("b", "2026-10-09", [["Press banca", [[8, 57.5]]]])], [], {}, "2026-10-17");
    expect(text).toContain("- 2026-10-11 a 2026-10-17: 1");
    expect(text).toContain("- Pecho: 1 | 0.5");
    expect(text).toContain("- Press banca: 57,5 kg × 8 (2026-10-09) → 60 kg × 8 (2026-10-16) | última: 1 × 8 · 60 kg");
    expect(text).toContain("PESO CORPORAL: (sin registros recientes)");
  });

  it("bounds the model's answer", () => {
    expect(cleanCoachAnswer({ summary: " Bien ", tips: ["a", 3, "", "b", "c", "d", "e"] })).toEqual({ summary: "Bien", tips: ["a", "b", "c", "d"] });
    expect(cleanCoachAnswer({ tips: [] })).toBeNull();
  });
});

describe("Jax asignar_musculos", () => {
  it("creates or updates a mapping with valid muscles only", () => {
    const refs = emptyRefs();
    const created = toProposal("asignar_musculos", { exercise: "Cc", muscles: ["biceps", "alas", "antebrazos"] }, refs);
    expect(created).toMatchObject({
      ok: true,
      proposal: { kind: "muscle.create", payload: { values: { exercise_key: "cc", muscles: ["biceps", "antebrazos"] } } },
    });
    if (created.ok) expect(planAction(created.proposal.kind, created.proposal.payload)).toMatchObject({ op: "insert", table: "exercise_muscles" });

    refs.mu.set("cc", { id: ID(1), label: "cc", values: { muscles: "biceps,antebrazos" } });
    expect(toProposal("asignar_musculos", { exercise: "CC", muscles: ["biceps", "antebrazos"] }, refs).ok).toBe(false);
    expect(toProposal("asignar_musculos", { exercise: "Cc", muscles: ["triceps"] }, refs)).toMatchObject({
      ok: true,
      proposal: { kind: "muscle.update", payload: { id: ID(1), changes: { muscles: ["triceps"] } } },
    });
    expect(toProposal("asignar_musculos", { exercise: "Cc", muscles: ["alas"] }, refs).ok).toBe(false);
  });
});
