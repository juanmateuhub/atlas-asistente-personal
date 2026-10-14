"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/user";
import { parseEventInput, type EventInput } from "@/lib/calendar/validation";
import { createClient } from "@/lib/supabase/server";
import { parseTaskId as parseId } from "@/lib/tasks/validation";

type FormState = { error?: string; ok?: boolean };

// user_id is never read from the client: the DB defaults it to auth.uid() and RLS
// rejects rows that aren't the caller's.

function toRow(e: EventInput) {
  return {
    title: e.title,
    event_date: e.date,
    start_time: e.startTime,
    end_time: e.endTime,
    location: e.location,
    notes: e.notes,
  };
}

export async function createEvent(_prev: FormState, fd: FormData): Promise<FormState> {
  await getCurrentUser();
  const parsed = parseEventInput(fd);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("events").insert(toRow(parsed.value));
  if (error) return { error: "No se ha podido crear el evento. Inténtalo de nuevo." };
  refresh();
  return { ok: true };
}

export async function updateEvent(_prev: FormState, fd: FormData): Promise<FormState> {
  await getCurrentUser();
  const id = parseId(fd.get("id"));
  const parsed = parseEventInput(fd);
  if (!id) return { error: "Evento no válido." };
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("events").update(toRow(parsed.value)).eq("id", id).select("id");
  if (error || data.length === 0) return { error: "No se ha podido guardar. Inténtalo de nuevo." };
  refresh();
  return { ok: true };
}

export async function deleteEvent(_prev: FormState, fd: FormData): Promise<FormState> {
  await getCurrentUser();
  const id = parseId(fd.get("id"));
  if (!id) return { error: "Evento no válido." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("events").delete().eq("id", id).select("id");
  if (error || data.length === 0) return { error: "No se ha podido borrar. Inténtalo de nuevo." };
  refresh();
  return { ok: true };
}
