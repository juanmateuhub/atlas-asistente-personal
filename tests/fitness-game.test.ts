import { describe, expect, it } from "vitest";
import {
  exerciseHistory,
  gameState,
  levelFor,
  rewardBetween,
  scoreWorkouts,
  statsFor,
  weekOf,
  weekStreak,
  xpToNext,
} from "@/lib/fitness/game";
import type { BodyWeight, Workout } from "@/lib/fitness/types";

const w = (id: string, date: string, sets: [number, number | null][], name = "Press banca"): Workout => ({
  id,
  title: "Torso",
  date,
  notes: null,
  exercises: [{ name, sets: sets.map(([reps, weight]) => ({ reps, weight })) }],
});

describe("levels", () => {
  it("climbs with growing steps", () => {
    expect(xpToNext(1)).toBe(100);
    expect(levelFor(0)).toMatchObject({ level: 1, title: "Novato", into: 0, needed: 100 });
    expect(levelFor(99).level).toBe(1);
    expect(levelFor(100)).toMatchObject({ level: 2, into: 0, needed: 140 });
    expect(levelFor(100 + 140 + 180)).toMatchObject({ level: 4, title: "Aprendiz" });
  });
});

describe("weeks", () => {
  it("starts on Monday", () => {
    expect(weekOf("2026-10-17")).toBe("2026-10-12"); // Saturday
    expect(weekOf("2026-10-12")).toBe("2026-10-12");
    expect(weekOf("2026-10-18")).toBe("2026-10-12"); // Sunday
  });

  it("counts the streak back from this week, alive until the week ends", () => {
    const ws = [w("a", "2026-09-29", [[5, 50]]), w("b", "2026-10-07", [[5, 50]]), w("c", "2026-10-15", [[5, 50]])];
    expect(weekStreak(ws, "2026-10-17")).toBe(3);
    // Nothing yet this week: last week's streak still counts.
    expect(weekStreak(ws.slice(0, 2), "2026-10-17")).toBe(2);
    expect(weekStreak(ws.slice(0, 1), "2026-10-17")).toBe(0);
    // An empty (just started) workout doesn't count.
    expect(weekStreak([w("x", "2026-10-15", [])], "2026-10-17")).toBe(0);
  });
});

describe("scoring", () => {
  it("gives XP for sets and volume, and records only when beating an earlier set", () => {
    const scored = scoreWorkouts([w("b", "2026-10-15", [[5, 70]]), w("a", "2026-10-10", [[8, 60], [8, 60]])]);
    expect(scored.map((s) => s.id)).toEqual(["a", "b"]);
    // a: 20 + 2 sets × 2 + floor(960/250) = 27, no record (first time).
    expect(scored[0]).toEqual({ id: "a", date: "2026-10-10", xp: 27, records: [] });
    // b: 20 + 2 + floor(350/250) + 25 record.
    expect(scored[1]).toEqual({ id: "b", date: "2026-10-15", xp: 48, records: ["Press banca"] });
    expect(scoreWorkouts([w("e", "2026-10-15", [])])[0].xp).toBe(0);
  });

  it("adds weekly quest bonuses and weigh-ins to the total", () => {
    const weights: BodyWeight[] = [{ id: "p", date: "2026-10-14", weightKg: 75 }];
    const week = [w("a", "2026-10-12", [[5, 50]]), w("b", "2026-10-14", [[5, 50]]), w("c", "2026-10-16", [[5, 55]])];
    const g = gameState(week, weights, 0, "2026-10-17");
    const workoutsXp = scoreWorkouts(week).reduce((s, x) => s + x.xp, 0);
    // 3 workouts (+50), a record (+30), a weigh-in (+15) and its 5 XP.
    expect(g.level.xp).toBe(workoutsXp + 50 + 30 + 15 + 5);
    expect(g.quests.every((q) => q.done)).toBe(true);
    expect(g.achievements.find((a) => a.id === "record")?.unlocked).toBe(true);
    expect(g.achievements.find((a) => a.id === "estratega")?.unlocked).toBe(false);
  });

  it("reports what a save earned", () => {
    const before = [w("a", "2026-10-10", [[8, 60]]), w("b", "2026-10-15", [])];
    const after = [before[0], w("b", "2026-10-15", [[5, 70]])];
    const r = rewardBetween(gameState(before, [], 0, "2026-10-17"), gameState(after, [], 0, "2026-10-17"), "b");
    expect(r.records).toEqual(["Press banca"]);
    expect(r.xp).toBeGreaterThan(0);
    expect(r.achievements).toEqual(["Rompemarcas"]);
  });
});

describe("stats and history", () => {
  it("rates strength relative to body weight and recent activity", () => {
    const ws = [w("a", "2026-10-15", [[1, 100]], "Sentadilla"), w("b", "2026-10-15", [[1, 80]]), w("c", "2026-10-15", [[1, 120]], "Peso muerto")];
    const s = statsFor(ws, [{ id: "p", date: "2026-10-15", weightKg: 75 }], "2026-10-17");
    expect(s.fuerza).toBe(72); // 300 / 75 × 18
    expect(s.constancia).toBe(8); // three sessions, one day
    expect(statsFor([], [], "2026-10-17")).toEqual({ fuerza: 0, resistencia: 0, constancia: 0 });
  });

  it("charts the heaviest set per session, oldest first", () => {
    const ws = [w("b", "2026-10-15", [[5, 70], [8, 60]]), w("a", "2026-10-10", [[8, 60]]), w("c", "2026-10-12", [[10, null]], "Dominadas")];
    expect(exerciseHistory(ws, "press banca")).toEqual([
      { date: "2026-10-10", weight: 60, reps: 8, oneRepMax: 76 },
      { date: "2026-10-15", weight: 70, reps: 5, oneRepMax: 81.5 },
    ]);
    expect(exerciseHistory(ws, "Dominadas")).toEqual([]);
  });
});
