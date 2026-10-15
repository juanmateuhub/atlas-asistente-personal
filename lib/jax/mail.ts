import "server-only";
import { matchingFilter } from "@/lib/mail/filters";
import { getMessage, listInbox, messageText, searchMessages, type MailSummary } from "@/lib/mail/gmail";
import { ReconnectError } from "@/lib/mail/google";
import { getMailAccessToken, getMailAccount, listMailFilters } from "@/lib/mail/queries";
import type { JaxMail } from "./context";
import { mailQuery, wantsMail } from "./mail-query";

const LIST_MAX = 8;
/** Full text only for the first few: enough to answer, without flooding the prompt. */
const BODIES = 3;
const BODY_CHARS = 1500;

/**
 * The user's UJI mail for Jax, read-only. null when the question is not about
 * mail. Junk filters apply here too. Never throws: mail is an extra source and
 * must not break an answer.
 */
export async function retrieveMail(question: string): Promise<JaxMail | null> {
  if (!wantsMail(question)) return null;
  try {
    const account = await getMailAccount();
    if (!account) return { status: "off" };
    const [token, filters] = await Promise.all([getMailAccessToken(account), listMailFilters()]);

    const q = mailQuery(question);
    const found: MailSummary[] = q ? await searchMessages(token, q, LIST_MAX * 2) : (await listInbox(token, undefined, LIST_MAX * 2)).messages;
    const kept = found
      .filter((m) => !matchingFilter({ subject: m.subject, from: `${m.fromName} ${m.fromAddress}` }, filters))
      .slice(0, LIST_MAX);

    const bodies = await Promise.all(
      kept.slice(0, BODIES).map((m) =>
        getMessage(token, m.id).then(
          (full) => messageText(full).slice(0, BODY_CHARS),
          () => null,
        ),
      ),
    );

    return {
      status: "ok",
      query: q,
      items: kept.map((m, i) => ({
        id: m.id,
        fromName: m.fromName,
        fromAddress: m.fromAddress,
        subject: m.subject,
        date: m.date,
        unread: m.unread,
        text: bodies[i] ?? m.snippet,
      })),
    };
  } catch (err) {
    return { status: err instanceof ReconnectError ? "expired" : "error" };
  }
}
