import { instantToZoned } from "@/lib/reminders/time";
import { sendPush } from "@/lib/push/send";
import { createAdminClient, isCronRequest } from "@/lib/supabase/admin";

export const maxDuration = 60;

/**
 * Called every minute by pg_cron: sends the reminders that are due. Each one is
 * claimed (sent_at set) before sending, so two overlapping runs never send it twice.
 */
export async function POST(request: Request) {
  if (!isCronRequest(request)) return Response.json({ error: "No autorizado" }, { status: 401 });
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: claimed, error } = await admin
    .from("reminders")
    .update({ sent_at: now })
    .is("sent_at", null)
    .lte("remind_at", now)
    .select("id,user_id,title,remind_at");
  if (error) return Response.json({ error: "No se han podido leer los recordatorios" }, { status: 500 });

  let delivered = 0;
  for (const r of claimed ?? []) {
    const late = Date.now() - Date.parse(r.remind_at) > 10 * 60_000;
    delivered += await sendPush(admin, r.user_id, {
      title: r.title,
      body: late ? `Recordatorio de las ${instantToZoned(r.remind_at).time} (llega con retraso)` : "Recordatorio de Jax",
      url: "/#recordatorios",
      tag: `reminder-${r.id}`,
    });
  }
  return Response.json({ reminders: claimed?.length ?? 0, delivered });
}
