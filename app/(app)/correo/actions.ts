"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth/user";
import { parseEventInput } from "@/lib/calendar/validation";
import { googleIdOf, pushEventChange } from "@/lib/calendar/google-sync";
import { decryptToken } from "@/lib/mail/crypto";
import { parseFilterInput } from "@/lib/mail/filters";
import { revokeToken } from "@/lib/mail/google";
import { createClient } from "@/lib/supabase/server";
import { parseTaskInput, parseTaskId as parseId } from "@/lib/tasks/validation";

type FormState = { error?: string; ok?: boolean };

export async function addMailFilter(_prev: FormState, fd: FormData): Promise<FormState> {
  await getCurrentUser();
  const parsed = parseFilterInput(fd);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("mail_filters").insert(parsed.value);
  if (error?.code === "23505") return { error: "Ya tienes ese filtro." };
  if (error) return { error: "No se ha podido añadir el filtro. Inténtalo de nuevo." };
  refresh();
  return { ok: true };
}

export async function deleteMailFilter(fd: FormData): Promise<void> {
  await getCurrentUser();
  const id = parseId(fd.get("id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("mail_filters").delete().eq("id", id);
  refresh();
}

/** Revokes Google's access and forgets the account. Filters are kept for a later reconnection. */
export async function disconnectMail(): Promise<FormState> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.from("mail_accounts").select("refresh_token_enc").maybeSingle();
  if (data) {
    try {
      await revokeToken(decryptToken(data.refresh_token_enc));
    } catch {
      // Undecryptable token: nothing to revoke, still remove the row.
    }
  }
  const { error } = await supabase.from("mail_accounts").delete().not("user_id", "is", null);
  if (error) return { error: "No se ha podido desconectar. Inténtalo de nuevo." };
  refresh();
  return { ok: true };
}

// --- suggestions Jax found in the mail ---------------------------------------------

type SuggestionResult = { ok?: boolean; error?: string; createdId?: string; href?: string };

function form(values: Record<string, unknown>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) if (v !== null && v !== undefined) fd.set(k, String(v));
  return fd;
}

/**
 * Adds a suggestion to Tareas or the calendar. The stored payload is validated
 * again with the form parsers; the suggestion is claimed first so it runs once.
 */
export async function acceptMailSuggestion(id: string): Promise<SuggestionResult> {
  await getCurrentUser();
  const suggestionId = parseId(id);
  if (!suggestionId) return { error: "Sugerencia no válida." };
  const supabase = await createClient();
  const { data: claimed } = await supabase
    .from("mail_suggestions")
    .update({ status: "accepted", resolved_at: new Date().toISOString() })
    .eq("id", suggestionId)
    .eq("status", "pending")
    .select("kind,payload");
  const s = claimed?.[0];
  if (!s) return { error: "Esta sugerencia ya no está pendiente." };
  const back = async (error: string) => {
    await supabase.from("mail_suggestions").update({ status: "pending", resolved_at: null }).eq("id", suggestionId);
    return { error };
  };
  const v = s.payload as Record<string, unknown>;

  if (s.kind === "task") {
    const p = parseTaskInput(form({ title: v.title, priority: v.priority, dueDate: v.due_date, notes: v.notes }));
    if (!p.ok) return back(p.error);
    const { data, error } = await supabase
      .from("tasks")
      .insert({ title: p.value.title, priority: p.value.priority, due_date: p.value.dueDate, notes: p.value.notes })
      .select("id")
      .single();
    if (error) return back("No se ha podido crear la tarea.");
    refresh();
    return { ok: true, createdId: data.id, href: "/tareas" };
  }

  const p = parseEventInput(
    form({ title: v.title, date: v.event_date, startTime: v.start_time, endTime: v.end_time, location: v.location, notes: v.notes }),
  );
  if (!p.ok) return back(p.error);
  const e = p.value;
  const { data, error } = await supabase
    .from("events")
    .insert({ title: e.title, event_date: e.date, start_time: e.startTime, end_time: e.endTime, location: e.location, notes: e.notes })
    .select("id")
    .single();
  if (error) return back("No se ha podido crear el evento.");
  after(() => pushEventChange(supabase, { op: "upsert", id: data.id }));
  refresh();
  return { ok: true, createdId: data.id, href: `/calendario?mes=${e.date.slice(0, 7)}&dia=${e.date}` };
}

/** "Deshacer" right after accepting: removes what was created and brings the suggestion back. */
export async function undoMailSuggestion(id: string, createdId: string): Promise<SuggestionResult> {
  await getCurrentUser();
  const suggestionId = parseId(id);
  const itemId = parseId(createdId);
  if (!suggestionId || !itemId) return { error: "No se puede deshacer." };
  const supabase = await createClient();
  const { data: s } = await supabase.from("mail_suggestions").select("kind").eq("id", suggestionId).eq("status", "accepted").maybeSingle();
  if (!s) return { error: "No se puede deshacer." };
  const table = s.kind === "task" ? "tasks" : "events";
  const googleId = table === "events" ? await googleIdOf(supabase, itemId) : null;
  await supabase.from(table).delete().eq("id", itemId);
  if (table === "events") after(() => pushEventChange(supabase, { op: "delete", googleId }));
  await supabase.from("mail_suggestions").update({ status: "pending", resolved_at: null }).eq("id", suggestionId);
  refresh();
  return { ok: true };
}

export async function dismissMailSuggestion(id: string): Promise<SuggestionResult> {
  await getCurrentUser();
  const suggestionId = parseId(id);
  if (!suggestionId) return { error: "Sugerencia no válida." };
  const supabase = await createClient();
  await supabase
    .from("mail_suggestions")
    .update({ status: "dismissed", resolved_at: new Date().toISOString() })
    .eq("id", suggestionId)
    .eq("status", "pending");
  refresh();
  return { ok: true };
}
