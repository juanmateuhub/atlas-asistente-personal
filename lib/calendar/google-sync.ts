import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deleteEvent,
  googleToAtlas,
  insertEvent,
  listCalendars,
  listEvents,
  patchEvent,
  type GoogleCalendar,
  type SyncedEvent,
} from "@/lib/google/calendar";
import { googleConnection, type GoogleConnection } from "@/lib/google/connection";
import { addDays } from "@/lib/jax/dates";
import { ReconnectError, hasCalendarListScope, hasCalendarScope } from "@/lib/mail/google";

/**
 * Two-way sync between `events` and the primary Google calendar of the
 * connected UJI account.
 *  - Atlas → Google: every create/update/delete made in Atlas (forms, Jax, mail
 *    suggestions) is pushed right away (best effort).
 *  - Google → Atlas: a window of days is pulled when the calendar is opened and
 *    every 15 minutes from pg_cron. Google wins when it changed after the last sync.
 * Rows with a google_event_id are linked; Atlas-only rows are pushed on the next pull.
 * The other calendars the user shows in Google (e.g. the UJI timetable) are pulled
 * too, read-only: Atlas never writes to them (google_calendar <> 'primary').
 */

const PAST_DAYS = 30;
const FUTURE_DAYS = 365;
/** Opening the calendar pulls again only after this long. */
const FRESH_MS = 3 * 60_000;
const COLS = "id,title,event_date,start_time,end_time,location,notes,google_event_id,google_updated_at,google_calendar";
export const PRIMARY = "primary";

type Row = SyncedEvent & { id: string; google_event_id: string | null; google_updated_at: string | null; google_calendar: string };

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);
const synced = (r: Row): SyncedEvent => ({
  title: r.title,
  event_date: r.event_date,
  start_time: hhmm(r.start_time),
  end_time: hhmm(r.end_time),
  location: r.location,
  notes: r.notes,
});

async function pushRow(supabase: SupabaseClient, conn: GoogleConnection, row: Row) {
  let ev = row.google_event_id ? await patchEvent(conn.token, row.google_event_id, synced(row)) : null;
  // Deleted in Google meanwhile, or never pushed: create it there.
  if (!ev) ev = await insertEvent(conn.token, synced(row));
  await supabase.from("events").update({ google_event_id: ev.id, google_updated_at: ev.updated ?? null }).eq("id", row.id);
}

export type EventChange = { op: "upsert"; id: string } | { op: "delete"; googleId: string | null };

/** Reflect one Atlas change in Google. Never throws: Atlas already saved it. */
export async function pushEventChange(supabase: SupabaseClient, change: EventChange): Promise<void> {
  if (change.op === "delete" && !change.googleId) return;
  try {
    const conn = await googleConnection(supabase);
    if (!conn?.calendar) return;
    if (change.op === "delete") {
      await deleteEvent(conn.token, change.googleId!);
      return;
    }
    const { data: row } = await supabase.from("events").select(COLS).eq("id", change.id).maybeSingle();
    if (row && row.google_calendar === PRIMARY) await pushRow(supabase, conn, row as Row);
  } catch (err) {
    console.error("[calendar] push failed", err instanceof Error ? err.message : err);
  }
}

/** Google id of an event, read before deleting it so Google can be told. */
export async function googleIdOf(supabase: SupabaseClient, id: string): Promise<string | null> {
  const { data } = await supabase.from("events").select("google_event_id").eq("id", id).maybeSingle();
  return data?.google_event_id ?? null;
}

/**
 * Pull the window of every shown Google calendar into Atlas and push Atlas-only
 * events. A calendar that fails to load is left untouched (nothing is deleted
 * for it); one the user stopped showing is removed from Atlas. Throws when the
 * primary calendar can't be read.
 */
export async function pullCalendar(supabase: SupabaseClient, conn: GoogleConnection, today: string) {
  const from = addDays(today, -PAST_DAYS);
  const to = addDays(today, FUTURE_DAYS);
  const [calendars, local] = await Promise.all([
    conn.calendarList
      ? listCalendars(conn.token).catch((): GoogleCalendar[] | null => null)
      : Promise.resolve(null),
    supabase
      .from("events")
      .select(COLS)
      .eq("user_id", conn.userId)
      .gte("event_date", from)
      .lte("event_date", to)
      .limit(5000),
  ]);
  if (local.error) throw new Error("No se han podido leer los eventos");
  const rows = (local.data ?? []) as Row[];
  const shown: GoogleCalendar[] = calendars ?? [{ id: PRIMARY, name: "", primary: true }];

  const fetched = await Promise.all(
    shown.map((c) =>
      listEvents(conn.token, from, to, c.id).then(
        (events) => ({ calendar: c, events }),
        (err) => {
          if (c.primary) throw err;
          return { calendar: c, events: null };
        },
      ),
    ),
  );

  const key = (calendar: string, id: string) => `${calendar}\n${id}`;
  const linked = new Map(rows.filter((r) => r.google_event_id).map((r) => [key(r.google_calendar, r.google_event_id!), r]));
  const loaded = new Set<string>();
  // The same calendar subscribed twice (or a class also in the primary one): keep the first copy only.
  const kept = new Set<string>();
  const seen = new Set<string>();
  const upserts: Record<string, unknown>[] = [];
  for (const { calendar, events } of fetched) {
    if (!events) continue;
    loaded.add(calendar.id);
    for (const ev of events) {
      const mapped = googleToAtlas(ev);
      if (!mapped) continue;
      const print = fingerprint(mapped);
      if (!calendar.primary && kept.has(print)) continue;
      kept.add(print);
      seen.add(key(calendar.id, ev.id));
      const mine = linked.get(key(calendar.id, ev.id));
      if (mine?.google_updated_at && ev.updated && Date.parse(ev.updated) <= Date.parse(mine.google_updated_at)) continue;
      upserts.push({
        user_id: conn.userId,
        google_calendar: calendar.id,
        google_calendar_name: calendar.primary ? null : calendar.name,
        google_event_id: ev.id,
        google_updated_at: ev.updated ?? null,
        ...mapped,
      });
    }
  }
  for (let i = 0; i < upserts.length; i += 500) {
    const { error } = await supabase
      .from("events")
      .upsert(upserts.slice(i, i + 500), { onConflict: "user_id,google_calendar,google_event_id" });
    if (error) throw new Error("No se han podido guardar los eventos de Google");
  }

  // Linked in Atlas but gone from a calendar that loaded (deleted there), or from a calendar no longer shown.
  const shownIds = new Set(shown.map((c) => c.id));
  const gone = rows
    .filter((r) => r.google_event_id)
    .filter((r) =>
      loaded.has(r.google_calendar)
        ? !seen.has(key(r.google_calendar, r.google_event_id!))
        : calendars !== null && !shownIds.has(r.google_calendar) && r.google_calendar !== PRIMARY,
    )
    .map((r) => r.id);
  // Small batches: the ids travel in the URL, which has a length limit.
  for (let i = 0; i < gone.length; i += 50) {
    const { error } = await supabase.from("events").delete().eq("user_id", conn.userId).in("id", gone.slice(i, i + 50));
    if (error) throw new Error("No se han podido quitar los eventos borrados en Google");
  }

  // Created in Atlas while Google was unreachable (or before the calendar was connected).
  for (const row of rows.filter((r) => !r.google_event_id && r.google_calendar === PRIMARY).slice(0, 40)) {
    await pushRow(supabase, conn, row);
  }

  await supabase.from("mail_accounts").update({ calendar_synced_at: new Date().toISOString() }).eq("user_id", conn.userId);
  console.info(`[calendar] synced: ${loaded.size} calendars, +${upserts.length}, -${gone.length}`);
  return { pulled: upserts.length, deleted: gone.length };
}

/** more-calendars: synced, but only the primary calendar until the user grants the calendar list. */
/** Same title, day and times: the same appointment, whichever calendar it comes from. */
export function fingerprint(e: SyncedEvent): string {
  return [e.title.trim().toLowerCase().replace(/\s+/g, " "), e.event_date, e.start_time ?? "", e.end_time ?? ""].join("|");
}

export type CalendarSyncStatus = "off" | "no-permission" | "more-calendars" | "ok" | "expired" | "error";

/** Pull before showing the calendar, unless a sync ran in the last few minutes. */
export async function syncCalendarIfStale(supabase: SupabaseClient, today: string): Promise<CalendarSyncStatus> {
  const { data: account } = await supabase.from("mail_accounts").select("scopes,calendar_synced_at").maybeSingle();
  if (!account) return "off";
  if (!hasCalendarScope(account.scopes)) return "no-permission";
  const done: CalendarSyncStatus = hasCalendarListScope(account.scopes) ? "ok" : "more-calendars";
  if (account.calendar_synced_at && Date.now() - Date.parse(account.calendar_synced_at) < FRESH_MS) return done;
  try {
    const conn = await googleConnection(supabase);
    if (!conn) return "off";
    await pullCalendar(supabase, conn, today);
    return done;
  } catch (err) {
    if (err instanceof ReconnectError) return "expired";
    console.error("[calendar] pull failed", err instanceof Error ? err.message : err);
    return "error";
  }
}
