import { describe, expect, it } from "vitest";
import { countDay, daySentence, formatLongDate, greeting, hourIn } from "@/lib/home/summary";
import type { Task } from "@/lib/tasks/types";
import type { ExamSummary } from "@/lib/university/types";

const task = (dueDate: string | null, status: Task["status"] = "pendiente"): Task => ({
  id: Math.random().toString(),
  title: "t",
  notes: null,
  priority: "media",
  status,
  dueDate,
  completedAt: null,
  createdAt: "",
});
const exam = (date: string, title = "Parcial"): ExamSummary => ({
  id: date,
  subjectId: "s",
  subjectName: "Redes",
  title,
  date,
  time: null,
  location: null,
  grade: null,
});

describe("greeting", () => {
  it("changes with the hour", () => {
    expect(greeting(7)).toBe("Buenos días");
    expect(greeting(15)).toBe("Buenas tardes");
    expect(greeting(23)).toBe("Buenas noches");
    expect(greeting(3)).toBe("Buenas noches");
  });

  it("reads the hour in Madrid", () => {
    expect(hourIn(new Date("2026-10-14T12:30:00Z"))).toBe(14); // CEST, UTC+2
    expect(hourIn(new Date("2026-12-14T12:30:00Z"))).toBe(13); // CET, UTC+1
  });
});

describe("day summary", () => {
  const today = "2026-10-14";

  it("formats the long date in Spanish", () => {
    expect(formatLongDate(today)).toBe("Miércoles, 14 de octubre");
  });

  it("counts today, overdue and this week's exams, ignoring done tasks", () => {
    const counts = countDay(
      [task("2026-10-14"), task("2026-10-14"), task("2026-10-10"), task("2026-10-14", "hecha"), task(null)],
      [exam("2026-10-16"), exam("2026-11-30")],
      today,
    );
    expect(counts).toMatchObject({ today: 2, overdue: 1, examsThisWeek: 1 });
  });

  it("writes one natural sentence", () => {
    expect(daySentence({ today: 2, overdue: 1, examsThisWeek: 1, nextExam: null })).toBe(
      "Tienes 2 tareas para hoy, 1 atrasada y 1 examen esta semana.",
    );
    expect(daySentence({ today: 1, overdue: 0, examsThisWeek: 0, nextExam: null })).toBe("Tienes 1 tarea para hoy.");
    expect(daySentence({ today: 0, overdue: 0, examsThisWeek: 0, nextExam: null })).toBe(
      "Día tranquilo. Nada urgente por ahora.",
    );
    expect(daySentence({ today: 0, overdue: 0, examsThisWeek: 0, nextExam: exam("2026-11-30", "Final") })).toBe(
      "Día tranquilo. Tu próximo examen es Final.",
    );
  });
});
