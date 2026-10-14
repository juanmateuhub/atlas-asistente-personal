import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Autosaver, type SaveOutcome, type SaveStatus } from "@/lib/university/autosave";
import { dateBadge, examCountdown } from "@/lib/university/format";
import { parseDoc, parseExamInput, parseSubjectInput, parseTitle } from "@/lib/university/validation";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("university validation", () => {
  it("requires a subject name and trims the description", () => {
    expect(parseSubjectInput(form({ name: " " })).ok).toBe(false);
    expect(parseSubjectInput(form({ name: "Redes", description: "  " }))).toEqual({
      ok: true,
      value: { name: "Redes", description: null },
    });
  });

  it("uses the right wording for each missing title", () => {
    expect(parseTitle(form({}), "página")).toEqual({ ok: false, error: "Escribe un título para la página." });
    expect(parseTitle(form({}), "tema")).toEqual({ ok: false, error: "Escribe un título para el tema." });
  });

  it("parses exams with optional time, location and comma decimals", () => {
    expect(parseExamInput(form({ title: "Parcial", date: "2026-11-20", grade: "7,5" }))).toEqual({
      ok: true,
      value: { title: "Parcial", date: "2026-11-20", time: null, location: null, grade: 7.5 },
    });
  });

  it("rejects bad exam dates, times and grades", () => {
    expect(parseExamInput(form({ title: "P", date: "" })).ok).toBe(false);
    expect(parseExamInput(form({ title: "P", date: "2026-11-20", time: "25:00" })).ok).toBe(false);
    expect(parseExamInput(form({ title: "P", date: "2026-11-20", grade: "10.5" })).ok).toBe(false);
    expect(parseExamInput(form({ title: "P", date: "2026-11-20", grade: "abc" })).ok).toBe(false);
  });

  it("only accepts Tiptap doc objects within the size limit", () => {
    expect(parseDoc({ type: "doc", content: [] }).ok).toBe(true);
    expect(parseDoc({ type: "paragraph" }).ok).toBe(false);
    expect(parseDoc("<script>alert(1)</script>").ok).toBe(false);
    expect(parseDoc({ type: "doc", content: "x" }).ok).toBe(false);
    const huge = { type: "doc", content: [{ type: "text", text: "x".repeat(500_000) }] };
    expect(parseDoc(huge).ok).toBe(false);
  });
});

describe("exam formatting", () => {
  it("builds a calendar badge", () => {
    expect(dateBadge("2026-11-20")).toEqual({ day: "20", month: "nov" });
  });

  it("describes how far an exam is", () => {
    const today = "2026-10-14"; // Wednesday
    expect(examCountdown("2026-10-14", today)).toBe("Hoy");
    expect(examCountdown("2026-10-15", today)).toBe("Mañana");
    expect(examCountdown("2026-10-16", today)).toBe("Este viernes");
    expect(examCountdown("2026-10-30", today)).toBe("En 16 días");
    expect(examCountdown("2026-10-13", today)).toBe("Fue ayer");
  });
});

describe("Autosaver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(results: SaveOutcome[]) {
    const statuses: SaveStatus[] = [];
    const save = vi.fn(async (_doc: string, expected: number) => {
      const next = results.shift() ?? { ok: true as const, version: expected + 1 };
      return next;
    });
    const saver = new Autosaver<string>({
      initialVersion: 1,
      save,
      onStatus: (s) => statuses.push(s),
      delayMs: 800,
      retryMs: 3000,
    });
    return { saver, save, statuses };
  }

  it("debounces edits into a single save of the latest content", async () => {
    const { saver, save, statuses } = setup([]);
    saver.change("a");
    saver.change("ab");
    saver.change("abc");
    await vi.advanceTimersByTimeAsync(799);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("abc", 1);
    expect(statuses.at(-1)).toBe("saved");
  });

  it("sends the next save with the version returned by the previous one", async () => {
    const { saver, save } = setup([]);
    saver.change("a");
    await vi.advanceTimersByTimeAsync(800);
    saver.change("b");
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenNthCalledWith(2, "b", 2);
  });

  it("retries network errors with the newest content", async () => {
    const { saver, save, statuses } = setup([{ ok: false, reason: "error", message: "" }]);
    saver.change("a");
    await vi.advanceTimersByTimeAsync(800);
    expect(statuses.at(-1)).toBe("retrying");
    saver.change("ab");
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenLastCalledWith("ab", 1);
    expect(statuses.at(-1)).toBe("saved");
  });

  it("stops saving after a conflict so newer data is not overwritten", async () => {
    const { saver, save, statuses } = setup([{ ok: false, reason: "conflict", message: "otra pestaña" }]);
    saver.change("a");
    await vi.advanceTimersByTimeAsync(800);
    expect(statuses.at(-1)).toBe("conflict");
    saver.change("b");
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(saver.hasPending()).toBe(false);
  });
});
