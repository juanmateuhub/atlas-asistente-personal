"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/user";
import { sendPush } from "@/lib/push/send";
import { parseReminderInput } from "@/lib/reminders/validation";
import { createClient } from "@/lib/supabase/server";
import { parseTaskId as parseId } from "@/lib/tasks/validation";

type FormState = { error?: string; ok?: boolean };

export async function createReminder(_prev: FormState, fd: FormData): Promise<FormState> {
  await getCurrentUser();
  const parsed = parseReminderInput(fd);
  if (!parsed.ok) return { error: parsed.error };
  const supabase = await createClient();
  const { error } = await supabase.from("reminders").insert({ title: parsed.value.title, remind_at: parsed.value.remindAt });
  if (error) return { error: "No se ha podido guardar el recordatorio. Inténtalo de nuevo." };
  refresh();
  return { ok: true };
}

export async function deleteReminder(id: string): Promise<FormState> {
  await getCurrentUser();
  const reminderId = parseId(id);
  if (!reminderId) return { error: "Recordatorio no válido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("reminders").delete().eq("id", reminderId).select("id");
  if (error || !data.length) return { error: "No se ha podido borrar. Inténtalo de nuevo." };
  refresh();
  return { ok: true };
}

type BrowserSubscription = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

/** Stores this device's push endpoint (the browser created it after the user allowed notifications). */
export async function savePushSubscription(sub: BrowserSubscription): Promise<FormState> {
  await getCurrentUser();
  const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : "";
  const p256dh = typeof sub?.keys?.p256dh === "string" ? sub.keys.p256dh : "";
  const auth = typeof sub?.keys?.auth === "string" ? sub.keys.auth : "";
  if (!endpoint.startsWith("https://") || endpoint.length > 1000 || !p256dh || !auth) {
    return { error: "Este navegador no ha dado una suscripción válida." };
  }
  const supabase = await createClient();
  // Same device signed in again (or another account on it): replace the old row.
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({ endpoint, p256dh, auth });
  if (error) return { error: "No se han podido activar los avisos. Inténtalo de nuevo." };
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<FormState> {
  await getCurrentUser();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", String(endpoint).slice(0, 1000));
  return { ok: true };
}

/** A notification right now, so the user sees that avisos work on this device. */
export async function sendTestPush(): Promise<FormState> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const sent = await sendPush(supabase, user.id, { title: "Avisos activados", body: "Así te avisará Jax.", url: "/", tag: "test" });
  return sent ? { ok: true } : { error: "No ha llegado el aviso. Revisa los permisos de notificaciones." };
}
