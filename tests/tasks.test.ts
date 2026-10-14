import { describe, expect, it } from "vitest";
import { daysBetween, dueInfo, todayIn } from "@/lib/tasks/dates";
import { parseFilter, toTask } from "@/lib/tasks/types";
import { isValidDate, parseTaskId, parseTaskInput } from "@/lib/tasks/validation";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("parseTaskInput", () => {
  it("accepts a minimal task with defaults", () => {
    expect(parseTaskInput(form({ title: "  Estudiar  " }))).toEqual({
      ok: true,
      value: { title: "Estudiar", notes: null, priority: "media", status: "pendiente", dueDate: null },
    });
  });

  it("rejects blank and too long titles", () => {
    expect(parseTaskInput(form({ title: "   " })).ok).toBe(false);
    expect(parseTaskInput(form({ title: "x".repeat(201) })).ok).toBe(false);
  });

  it("rejects unknown priority, status and impossible dates", () => {
    expect(parseTaskInput(form({ title: "a", priority: "urgente" })).ok).toBe(false);
    expect(parseTaskInput(form({ title: "a", status: "borrada" })).ok).toBe(false);
    expect(parseTaskInput(form({ title: "a", dueDate: "2026-02-30" })).ok).toBe(false);
  });

  it("keeps a valid due date and notes", () => {
    const r = parseTaskInput(form({ title: "a", dueDate: "2026-10-20", notes: " tema 3 " }));
    expect(r).toMatchObject({ ok: true, value: { dueDate: "2026-10-20", notes: "tema 3" } });
  });
});

describe("ids and dates", () => {
  it("only accepts UUIDs as task ids", () => {
    expect(parseTaskId("1; drop table tasks")).toBeNull();
    expect(parseTaskId("3f2b8c1e-9d4a-4b7e-8f21-0a1b2c3d4e5f")).toBe("3f2b8c1e-9d4a-4b7e-8f21-0a1b2c3d4e5f");
  });

  it("validates calendar dates including leap years", () => {
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(isValidDate("2027-02-29")).toBe(false);
    expect(isValidDate("20-10-2026")).toBe(false);
  });

  it("computes today in Madrid, not UTC", () => {
    // 23:30 UTC on 31 Dec is already 1 Jan in Madrid (UTC+1 in winter).
    expect(todayIn(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    // 22:30 UTC in summer is 00:30 next day in Madrid (UTC+2).
    expect(todayIn(new Date("2026-07-14T22:30:00Z"))).toBe("2026-07-15");
  });

  it("counts days across DST changes", () => {
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
});

describe("dueInfo", () => {
  const today = "2026-10-14";
  it("labels overdue, today, tomorrow and near dates", () => {
    expect(dueInfo("2026-10-13", today)).toEqual({ label: "Venció ayer", tone: "overdue" });
    expect(dueInfo("2026-10-10", today)).toEqual({ label: "Venció hace 4 días", tone: "overdue" });
    expect(dueInfo("2026-10-14", today)).toEqual({ label: "Vence hoy", tone: "soon" });
    expect(dueInfo("2026-10-15", today)).toEqual({ label: "Vence mañana", tone: "soon" });
    expect(dueInfo("2026-10-18", today)).toEqual({ label: "En 4 días", tone: "normal" });
  });

  it("shows a short date for far deadlines", () => {
    expect(dueInfo("2026-11-03", today).label).toMatch(/3 nov/);
  });
});

describe("mapping", () => {
  it("maps DB rows to domain tasks and guards unknown enums", () => {
    const task = toTask({
      id: "x",
      title: "t",
      notes: null,
      priority: "rara",
      status: "hecha",
      due_date: "2026-10-20",
      completed_at: null,
      created_at: "2026-10-14T10:00:00Z",
    });
    expect(task).toMatchObject({ priority: "media", status: "hecha", dueDate: "2026-10-20" });
  });

  it("defaults unknown filters to pendientes", () => {
    expect(parseFilter("hechas")).toBe("hechas");
    expect(parseFilter(["todas"])).toBe("pendientes");
    expect(parseFilter(undefined)).toBe("pendientes");
  });
});

describe("Nocturne task helpers", async () => {
  const { relativeDue } = await import("@/lib/tasks/dates");
  const { compareTasks, matchesFilter } = await import("@/lib/tasks/types");
  const task = (id: string, dueDate: string | null, priority: "alta" | "media" | "baja", createdAt = "2026-10-01") =>
    toTask({ id, title: id, notes: null, priority, status: "pendiente", due_date: dueDate, completed_at: null, created_at: createdAt });

  it("words due dates like the redesign", () => {
    const today = "2026-10-14";
    expect(relativeDue(null, today)).toBe("Sin fecha");
    expect(relativeDue("2026-10-14", today)).toBe("Hoy");
    expect(relativeDue("2026-10-15", today)).toBe("Mañana");
    expect(relativeDue("2026-10-13", today)).toBe("Ayer");
    expect(relativeDue("2026-10-16", today)).toBe("En 2 días");
    expect(relativeDue("2026-10-09", today)).toBe("Hace 5 días");
    expect(relativeDue("2026-10-30", today)).toBe("30 oct");
  });

  it("orders like the server: due date (none last), priority, creation", () => {
    const list = [
      task("sin-fecha", null, "alta"),
      task("tarde", "2026-10-20", "alta"),
      task("pronto-baja", "2026-10-15", "baja"),
      task("pronto-alta", "2026-10-15", "alta"),
    ].sort(compareTasks);
    expect(list.map((t) => t.id)).toEqual(["pronto-alta", "pronto-baja", "tarde", "sin-fecha"]);
  });

  it("keeps animating rows visible in every filter", () => {
    expect(matchesFilter(true, false, "pendientes")).toBe(false);
    expect(matchesFilter(true, true, "pendientes")).toBe(true);
    expect(matchesFilter(false, false, "hechas")).toBe(false);
    expect(matchesFilter(false, false, "todas")).toBe(true);
  });
});
