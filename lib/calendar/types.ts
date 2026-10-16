export type CalendarEvent = {
  id: string;
  title: string;
  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:MM` or null (all-day) */
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  /** Name of the Google calendar it comes from when that is not the primary one (e.g. "Les teues classes"): read-only. */
  calendarName: string | null;
};

/** Anything shown on a calendar day, from events, tasks or exams. */
export type AgendaItem =
  | { kind: "event"; id: string; date: string; time: string | null; title: string; event: CalendarEvent }
  | { kind: "task"; id: string; date: string; time: null; title: string; done: boolean }
  | { kind: "exam"; id: string; date: string; time: string | null; title: string; subjectId: string; subjectName: string };

/** All-day items first, then by time, then by kind (exams before events before tasks). */
export function sortAgenda(items: AgendaItem[]): AgendaItem[] {
  const rank = { exam: 0, event: 1, task: 2 } as const;
  return [...items].sort((a, b) => {
    if (a.time !== b.time) {
      if (a.time === null) return -1;
      if (b.time === null) return 1;
      return a.time.localeCompare(b.time);
    }
    return rank[a.kind] - rank[b.kind] || a.title.localeCompare(b.title, "es");
  });
}

export function groupByDate(items: AgendaItem[]): Map<string, AgendaItem[]> {
  const map = new Map<string, AgendaItem[]>();
  for (const item of items) {
    const list = map.get(item.date);
    if (list) list.push(item);
    else map.set(item.date, [item]);
  }
  for (const [date, list] of map) map.set(date, sortAgenda(list));
  return map;
}
