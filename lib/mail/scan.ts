import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateJson } from "@/lib/jax/providers/gemini";
import { sendPush } from "@/lib/push/send";
import { todayIn } from "@/lib/tasks/dates";
import { matchingFilter, type FilterField } from "./filters";
import { gmailUrl } from "./format";
import { getMessage, messageText, searchMessages } from "./gmail";
import { SCAN_SCHEMA, SCAN_SYSTEM, scanPrompt, toSuggestions, type Found, type ScannedMail } from "./suggestions";

/** Per run and account: enough for 15 minutes of university mail. */
const MAX_MESSAGES = 12;
const BODY_CHARS = 2500;
/** The first scan after connecting looks back this far. */
const FIRST_LOOKBACK_MS = 24 * 3_600_000;

/**
 * Reads the mail that arrived since the last scan (junk filters apply), asks
 * Gemini for dated tasks/events and stores them as suggestions the user accepts
 * or dismisses in Inicio. Runs from pg_cron with the admin client, so every query
 * is scoped by user_id. Returns how many new suggestions there are.
 */
export async function scanNewMail(
  admin: SupabaseClient,
  account: { userId: string; email: string; token: string; scannedAt: string | null },
  now = new Date(),
): Promise<number> {
  const since = account.scannedAt ? Date.parse(account.scannedAt) : now.getTime() - FIRST_LOOKBACK_MS;
  const found = await searchMessages(account.token, `in:inbox after:${Math.floor(since / 1000)}`, MAX_MESSAGES * 2);

  const [{ data: filters }, { data: seen }] = await Promise.all([
    admin.from("mail_filters").select("id,field,pattern").eq("user_id", account.userId),
    found.length
      ? admin.from("mail_suggestions").select("gmail_id").eq("user_id", account.userId).in("gmail_id", found.map((m) => m.id))
      : Promise.resolve({ data: [] as { gmail_id: string }[] }),
  ]);
  const seenIds = new Set((seen ?? []).map((s) => s.gmail_id));
  const rules = (filters ?? []).map((f) => ({ id: f.id, field: f.field as FilterField, pattern: f.pattern }));
  const fresh = found
    .filter((m) => !seenIds.has(m.id) && !matchingFilter({ subject: m.subject, from: `${m.fromName} ${m.fromAddress}` }, rules))
    .slice(0, MAX_MESSAGES);

  let inserted = 0;
  if (fresh.length) {
    const mails: ScannedMail[] = await Promise.all(
      fresh.map(async (m, i) => ({
        ref: `m${i + 1}`,
        id: m.id,
        fromName: m.fromName,
        fromAddress: m.fromAddress,
        subject: m.subject,
        date: m.date,
        text: await getMessage(account.token, m.id).then(
          (full) => messageText(full).slice(0, BODY_CHARS),
          () => m.snippet,
        ),
      })),
    );
    const today = todayIn(now);
    const answer = await generateJson<{ items: Found[] }>({ system: SCAN_SYSTEM, prompt: scanPrompt(today, mails), schema: SCAN_SCHEMA });
    const suggestions = toSuggestions(answer?.items ?? [], mails, today, (id) => gmailUrl(account.email, id));

    if (suggestions.length) {
      const { data } = await admin
        .from("mail_suggestions")
        .upsert(
          suggestions.map((s) => ({ ...s, user_id: account.userId })),
          { onConflict: "user_id,gmail_id,kind", ignoreDuplicates: true },
        )
        .select("id");
      inserted = data?.length ?? 0;
    }
  }

  await admin.from("mail_accounts").update({ scanned_at: now.toISOString() }).eq("user_id", account.userId);

  if (inserted) {
    await sendPush(admin, account.userId, {
      title: "Jax ha leído tu correo",
      body: inserted === 1 ? "Hay 1 cosa que quizá quieras apuntar." : `Hay ${inserted} cosas que quizá quieras apuntar.`,
      url: "/#sugerencias",
      tag: "mail-suggestions",
    });
  }
  return inserted;
}
