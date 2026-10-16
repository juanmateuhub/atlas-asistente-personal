import "server-only";
import { getCurrentUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import type { AgendaItem, CalendarEvent } from "./types";

type EventRow = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  google_calendar: string;
  google_calendar_name: string | null;
};

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

function toEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    date: row.event_date,
    startTime: hhmm(row.start_time),
    endTime: hhmm(row.end_time),
    location: row.location,
    notes: row.notes,
    calendarName: row.google_calendar === "primary" ? null : (row.google_calendar_name ?? "Google Calendar"),
  };
}

/**
 * Everything dated between `from` and `to` (inclusive): events, tasks with a
 * due date and exams. Tasks and exams are read from their own tables.
 */
export async function listAgenda(from: string, to: string): Promise<AgendaItem[]> {
  await getCurrentUser();
  const supabase = await createClient();

  const [events, tasks, exams] = await Promise.all([
    supabase
      .from("events")
      .select("id,title,event_date,start_time,end_time,location,notes,google_calendar,google_calendar_name")
      .gte("event_date", from)
      .lte("event_date", to)
      .limit(1000),
    supabase.from("tasks").select("id,title,status,due_date").gte("due_date", from).lte("due_date", to).limit(1000),
    supabase
      .from("exams")
      .select("id,title,exam_date,exam_time,subject_id,subjects(name)")
      .gte("exam_date", from)
      .lte("exam_date", to)
      .limit(1000),
  ]);
  if (events.error || tasks.error || exams.error) throw new Error("No se ha podido cargar el calendario.");

  return [
    ...events.data.map((row): AgendaItem => {
      const event = toEvent(row);
      return { kind: "event", id: event.id, date: event.date, time: event.startTime, title: event.title, event };
    }),
    ...tasks.data.map(
      (row): AgendaItem => ({
        kind: "task",
        id: row.id,
        date: row.due_date as string,
        time: null,
        title: row.title,
        done: row.status === "hecha",
      }),
    ),
    ...exams.data.map(
      (row): AgendaItem => ({
        kind: "exam",
        id: row.id,
        date: row.exam_date,
        time: hhmm(row.exam_time),
        title: row.title,
        subjectId: row.subject_id,
        subjectName: (row.subjects as unknown as { name: string } | null)?.name ?? "",
      }),
    ),
  ];
}
