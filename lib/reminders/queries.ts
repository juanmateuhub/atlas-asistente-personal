import "server-only";
import { getCurrentUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export type Reminder = { id: string; title: string; remindAt: string; sentAt: string | null };

/** Upcoming reminders plus the ones that went off in the last 12 hours, soonest first. */
export async function listReminders(now = new Date()): Promise<Reminder[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reminders")
    .select("id,title,remind_at,sent_at")
    .gte("remind_at", new Date(now.getTime() - 12 * 3_600_000).toISOString())
    .order("remind_at")
    .limit(30);
  if (error) throw new Error("No se han podido cargar los recordatorios.");
  return data.map((r) => ({ id: r.id, title: r.title, remindAt: r.remind_at, sentAt: r.sent_at }));
}
