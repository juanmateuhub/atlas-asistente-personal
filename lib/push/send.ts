import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

export type PushMessage = {
  title: string;
  body: string;
  /** App path opened when the notification is tapped. */
  url: string;
  /** Same tag = the newer notification replaces the older one. */
  tag?: string;
};

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:atlas@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

/**
 * Sends a notification to every device of the user. Subscriptions the push
 * service no longer knows (404/410) are removed. Returns how many devices got it.
 * `supabase` is the admin client in background jobs, or the user's own client.
 */
export async function sendPush(supabase: SupabaseClient, userId: string, message: PushMessage): Promise<number> {
  if (!pushConfigured()) return 0;
  configure();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", userId)
    .limit(20);

  const payload = JSON.stringify(message);
  const results = await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 60 * 60 * 12,
          urgency: "high",
        });
        return true;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await supabase.from("push_subscriptions").delete().eq("id", s.id);
        return false;
      }
    }),
  );
  return results.filter(Boolean).length;
}
