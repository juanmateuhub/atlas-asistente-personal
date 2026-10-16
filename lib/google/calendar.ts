/**
 * Google Calendar REST helpers (Atlas writes only to the primary calendar and
 * reads the others the user shows), plus the pure
 * conversions between a Google event and an Atlas `events` row (tested).
 * Atlas events are single-day in Madrid wall time; Google events are mapped onto
 * their start day.
 */
import { addDays } from "@/lib/jax/dates";
import { instantToZoned, zonedToInstant } from "@/lib/reminders/time";
import { LOCATION_MAX, NOTES_MAX, TITLE_MAX } from "@/lib/calendar/validation";
import { APP_TIME_ZONE } from "@/lib/tasks/dates";

const BASE = "https://www.googleapis.com/calendar/v3";
const API = `${BASE}/calendars/primary/events`;

export type GoogleCalendar = { id: string; name: string; primary: boolean };

type When = { date?: string; dateTime?: string; timeZone?: string };

export type GoogleEvent = {
  id: string;
  status?: "confirmed" | "tentative" | "cancelled";
  eventType?: string;
  summary?: string;
  location?: string;
  description?: string;
  start?: When;
  end?: When;
  /** RFC 3339: last modification in Google. */
  updated?: string;
  extendedProperties?: { private?: Record<string, string> };
};

/** The columns of `events` that are synced. */
export type SyncedEvent = {
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
};

export class CalendarError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Kinds Google adds on its own that are not appointments. */
const SKIPPED_TYPES = new Set(["workingLocation", "focusTime", "outOfOffice"]);

const plain = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

const cut = (s: string | undefined, max: number) => {
  const v = (s ?? "").trim();
  return v ? v.slice(0, max) : null;
};

/** Google event → Atlas row, or null when it should not appear in Atlas. */
export function googleToAtlas(ev: GoogleEvent): SyncedEvent | null {
  if (ev.status === "cancelled" || (ev.eventType && SKIPPED_TYPES.has(ev.eventType))) return null;
  const base = {
    title: cut(ev.summary, TITLE_MAX) ?? "(Sin título)",
    location: cut(ev.location, LOCATION_MAX),
    notes: ev.description ? cut(plain(ev.description), NOTES_MAX) : null,
  };

  if (ev.start?.date) return { ...base, event_date: ev.start.date, start_time: null, end_time: null };
  if (!ev.start?.dateTime) return null;

  const start = instantToZoned(ev.start.dateTime);
  let end: string | null = null;
  if (ev.end?.dateTime) {
    const e = instantToZoned(ev.end.dateTime);
    // Atlas events end on the day they start; ending at midnight or later drops the end.
    if (e.date === start.date && e.time > start.time) end = e.time;
    // Pushed by Atlas without an end: Google needed one (+1 h), Atlas keeps none.
    const noEnd = ev.extendedProperties?.private?.atlasNoEnd === "1";
    if (noEnd && Date.parse(ev.end.dateTime) - Date.parse(ev.start.dateTime) === 3_600_000) end = null;
  }
  return { ...base, event_date: start.date, start_time: start.time, end_time: end };
}

/** Atlas row → Google event body (insert or patch). */
export function atlasToGoogle(row: SyncedEvent) {
  const common = {
    summary: row.title,
    location: row.location ?? "",
    description: row.notes ?? "",
  };
  const start = row.start_time?.slice(0, 5) ?? null;
  const end = row.end_time?.slice(0, 5) ?? null;

  if (!start) {
    return {
      ...common,
      start: { date: row.event_date },
      end: { date: addDays(row.event_date, 1) },
      extendedProperties: { private: { atlasNoEnd: "0" } },
    };
  }
  const startIso = zonedToInstant(row.event_date, start);
  const endIso = end ? zonedToInstant(row.event_date, end) : new Date(Date.parse(startIso) + 3_600_000).toISOString();
  return {
    ...common,
    start: { dateTime: startIso, timeZone: APP_TIME_ZONE },
    end: { dateTime: endIso, timeZone: APP_TIME_ZONE },
    extendedProperties: { private: { atlasNoEnd: end ? "0" : "1" } },
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call<T>(token: string, url: string, init?: { method: "POST" | "PATCH" | "DELETE"; body?: unknown }): Promise<T | null> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, ...(init?.body !== undefined && { "Content-Type": "application/json" }) },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
    if (res.status === 204) return null;
    if (res.ok) return (await res.json()) as T;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 2) {
      // Google's reason (accessNotConfigured, insufficientPermissions…), never event data.
      const body = (await res.json().catch(() => null)) as { error?: { errors?: { reason?: string }[]; status?: string } } | null;
      const reason = body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? "";
      throw new CalendarError(`Calendar ${res.status} ${reason}`.trim(), res.status);
    }
    await sleep(300 * 2 ** attempt + Math.random() * 200);
  }
}

/** The calendars ticked in Google Calendar's sidebar (the primary one always first). */
export async function listCalendars(token: string): Promise<GoogleCalendar[]> {
  const res = await call<{ items?: { id: string; summary?: string; summaryOverride?: string; primary?: boolean; selected?: boolean }[] }>(
    token,
    `${BASE}/users/me/calendarList?${new URLSearchParams({ minAccessRole: "reader", maxResults: "100" })}`,
  );
  return (res?.items ?? [])
    .filter((c) => c.primary || c.selected)
    .map((c) => ({ id: c.primary ? "primary" : c.id, name: (c.summaryOverride || c.summary || "Google Calendar").slice(0, 150), primary: Boolean(c.primary) }))
    .sort((a, b) => Number(b.primary) - Number(a.primary));
}

/** Every event (recurring ones expanded) of one calendar that starts between the two days, inclusive. */
export async function listEvents(token: string, fromDate: string, toDate: string, calendarId = "primary"): Promise<GoogleEvent[]> {
  const out: GoogleEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({
      singleEvents: "true",
      showDeleted: "false",
      maxResults: "2500",
      timeMin: zonedToInstant(fromDate, "00:00"),
      timeMax: zonedToInstant(addDays(toDate, 1), "00:00"),
    });
    if (pageToken) params.set("pageToken", pageToken);
    const url = `${BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
    const res = await call<{ items?: GoogleEvent[]; nextPageToken?: string }>(token, url);
    out.push(...(res?.items ?? []));
    pageToken = res?.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

export async function insertEvent(token: string, row: SyncedEvent): Promise<GoogleEvent> {
  return (await call<GoogleEvent>(token, API, { method: "POST", body: atlasToGoogle(row) }))!;
}

/** null when the event no longer exists in Google (deleted there). */
export async function patchEvent(token: string, id: string, row: SyncedEvent): Promise<GoogleEvent | null> {
  try {
    return await call<GoogleEvent>(token, `${API}/${encodeURIComponent(id)}`, { method: "PATCH", body: atlasToGoogle(row) });
  } catch (err) {
    if (err instanceof CalendarError && (err.status === 404 || err.status === 410)) return null;
    throw err;
  }
}

/** Already gone in Google counts as deleted. */
export async function deleteEvent(token: string, id: string): Promise<void> {
  try {
    await call(token, `${API}/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (err) {
    if (err instanceof CalendarError && (err.status === 404 || err.status === 410)) return;
    throw err;
  }
}
