import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Citation } from "./context";

export const RETENTION_DAYS = 7;
export const MESSAGE_MAX = 2000;
/** Protects the free Gemini quota from runaway use. */
export const DAILY_MESSAGE_LIMIT = 150;

export type JaxActionStatus = "pending" | "applied" | "dismissed" | "failed" | "undone";
/** mail: the draft, so the user can read it before confirming. */
export type JaxActionView = {
  id: string;
  kind: string;
  summary: string;
  status: JaxActionStatus;
  href: string | null;
  mail?: { to: string[]; subject: string; body: string };
};

/** The preview of a mail.send payload (other payloads are never sent to the browser). */
export function mailPreview(kind: string, payload: unknown): JaxActionView["mail"] {
  if (kind !== "mail.send") return undefined;
  const m = (payload as { mail?: { to?: unknown; subject?: unknown; body?: unknown } } | null)?.mail;
  return {
    to: Array.isArray(m?.to) ? m.to.filter((a): a is string => typeof a === "string") : [],
    subject: typeof m?.subject === "string" ? m.subject : "",
    body: typeof m?.body === "string" ? m.body : "",
  };
}

export type JaxMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  actions: JaxActionView[];
};

function cutoff(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** The rolling conversation: last 7 days, oldest first. */
export async function listConversation(supabase: SupabaseClient, limit = 100): Promise<JaxMessage[]> {
  const { data, error } = await supabase
    .from("jax_messages")
    .select("id,role,content,citations,jax_actions(id,kind,summary,status,href,payload,created_at)")
    .gte("created_at", cutoff(RETENTION_DAYS))
    .order("position", { ascending: false })
    .limit(limit);
  if (error) throw new Error("No se ha podido cargar la conversación.");
  return data.reverse().map((m) => ({
    id: m.id,
    role: m.role as JaxMessage["role"],
    content: m.content,
    citations: Array.isArray(m.citations) ? (m.citations as Citation[]) : [],
    actions: ((m.jax_actions ?? []) as (JaxActionView & { created_at: string; payload: unknown })[])
      .toSorted((a, b) => a.created_at.localeCompare(b.created_at))
      .map(({ id, kind, summary, status, href, payload }) => ({ id, kind, summary, status, href, mail: mailPreview(kind, payload) })),
  }));
}

/** Delete the caller's messages older than the retention window (RLS scopes it). */
export async function pruneOldMessages(supabase: SupabaseClient) {
  await supabase.from("jax_messages").delete().lt("created_at", cutoff(RETENTION_DAYS));
}

export async function countRecentQuestions(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from("jax_messages")
    .select("id", { count: "exact", head: true })
    .eq("role", "user")
    .gte("created_at", cutoff(1));
  return count ?? 0;
}
