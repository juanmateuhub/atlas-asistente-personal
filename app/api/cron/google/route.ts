import { pullCalendar } from "@/lib/calendar/google-sync";
import { googleConnection } from "@/lib/google/connection";
import { ReconnectError } from "@/lib/mail/google";
import { scanNewMail } from "@/lib/mail/scan";
import { createAdminClient, isCronRequest } from "@/lib/supabase/admin";
import { todayIn } from "@/lib/tasks/dates";

export const maxDuration = 300;

/**
 * Called every 15 minutes by pg_cron: for each connected Google account, Jax
 * reads the new mail (suggestions in Inicio) and Google Calendar is pulled.
 * One account failing never stops the others. Logs carry counts, never content.
 */
export async function POST(request: Request) {
  if (!isCronRequest(request)) return Response.json({ error: "No autorizado" }, { status: 401 });
  const admin = createAdminClient();
  const { data: accounts } = await admin.from("mail_accounts").select("user_id,scanned_at").limit(100);

  const results: Record<string, string> = {};
  const now = new Date();
  for (const [i, account] of (accounts ?? []).entries()) {
    const label = `a${i + 1}`;
    try {
      const conn = await googleConnection(admin, account.user_id);
      if (!conn) continue;
      const found = await scanNewMail(admin, { ...conn, scannedAt: account.scanned_at }, now).catch((err) => {
        console.error(`[cron google] ${label} mail scan failed`, err instanceof Error ? err.message : err);
        return -1;
      });
      let calendar = "off";
      if (conn.calendar) {
        calendar = await pullCalendar(admin, conn, todayIn(now)).then(
          (r) => `+${r.pulled}/-${r.deleted}`,
          (err) => {
            console.error(`[cron google] ${label} calendar failed`, err instanceof Error ? err.message : err);
            return "error";
          },
        );
      }
      results[label] = `mail ${found}, calendar ${calendar}`;
    } catch (err) {
      results[label] = err instanceof ReconnectError ? "reconnect" : "error";
    }
  }
  console.info("[cron google]", results);
  return Response.json({ accounts: results });
}
