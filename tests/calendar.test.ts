import { describe, expect, it } from "vitest";
import { formatDay, formatMonth, monthGrid, parseDay, parseMonth, shiftMonth } from "@/lib/calendar/grid";
import { groupByDate, sortAgenda, type AgendaItem } from "@/lib/calendar/types";
import { parseEventInput } from "@/lib/calendar/validation";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("month grid", () => {
  it("starts on Monday and always has 6 full weeks", () => {
    const grid = monthGrid("2026-10"); // 1 Oct 2026 is a Thursday
    expect(grid).toHaveLength(6);
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid[0][0]).toBe("2026-09-28");
    expect(grid[0][3]).toBe("2026-10-01");
    expect(grid[5][6]).toBe("2026-11-08");
  });

  it("handles a month starting on Monday and leap Februaries", () => {
    expect(monthGrid("2027-02")[0][0]).toBe("2027-02-01");
    expect(monthGrid("2028-02").flat()).toContain("2028-02-29");
  });

  it("shifts months across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("parses URL params defensively", () => {
    expect(parseMonth("2026-13", "2026-10")).toBe("2026-10");
    expect(parseMonth(["2026-11"], "2026-10")).toBe("2026-10");
    expect(parseMonth("2026-11", "2026-10")).toBe("2026-11");
    expect(parseDay("2026-02-30", "2026-10-14")).toBe("2026-10-14");
  });

  it("formats titles in Spanish", () => {
    expect(formatMonth("2026-10")).toBe("Octubre de 2026");
    expect(formatDay("2026-10-20")).toBe("Martes, 20 de octubre");
  });
});

describe("parseEventInput", () => {
  it("accepts a timed event", () => {
    expect(parseEventInput(form({ title: "Tutoría", date: "2026-10-20", startTime: "10:00", endTime: "11:30" }))).toEqual({
      ok: true,
      value: { title: "Tutoría", date: "2026-10-20", startTime: "10:00", endTime: "11:30", location: null, notes: null },
    });
  });

  it("drops times for all-day events", () => {
    const r = parseEventInput(form({ title: "Fiesta", date: "2026-10-21", allDay: "on", startTime: "10:00" }));
    expect(r).toMatchObject({ ok: true, value: { startTime: null, endTime: null } });
  });

  it("rejects end before start and end without start", () => {
    expect(parseEventInput(form({ title: "a", date: "2026-10-20", startTime: "11:00", endTime: "10:00" })).ok).toBe(false);
    expect(parseEventInput(form({ title: "a", date: "2026-10-20", endTime: "10:00" })).ok).toBe(false);
  });
});

describe("agenda", () => {
  const ev = (id: string, time: string | null): AgendaItem => ({
    kind: "event",
    id,
    date: "2026-10-20",
    time,
    title: id,
    event: { id, title: id, date: "2026-10-20", startTime: time, endTime: null, location: null, notes: null },
  });
  const task: AgendaItem = { kind: "task", id: "t", date: "2026-10-20", time: null, title: "t", done: false };
  const exam: AgendaItem = { kind: "exam", id: "x", date: "2026-10-20", time: null, title: "x", subjectId: "s", subjectName: "Redes" };

  it("puts all-day items first (exams, events, tasks), then by time", () => {
    const sorted = sortAgenda([ev("late", "18:00"), task, ev("early", "09:00"), exam, ev("allday", null)]);
    expect(sorted.map((i) => i.id)).toEqual(["x", "allday", "t", "early", "late"]);
  });

  it("groups items by date", () => {
    const grouped = groupByDate([ev("a", null), { ...task, date: "2026-10-21" }]);
    expect([...grouped.keys()]).toEqual(["2026-10-20", "2026-10-21"]);
  });
});
