import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Citation } from "./context";

export const RETENTION_DAYS = 7;
export const MESSAGE_MAX = 2000;
/** Protects the free Gemini quota from runaway use. */
export const DAILY_MESSAGE_LIMIT = 150;

export type JaxActionStatus = "pending" | "applied" | "dismissed" | "failed" | "undone";
export type JaxActionView = { id: string; kind: string; summary: string; status: JaxActionStatus; href: string | null };

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
    .select("id,role,content,citations,jax_actions(id,kind,summary,status,href,created_at)")
    .gte("created_at", cutoff(RETENTION_DAYS))
    .order("position", { ascending: false })
    .limit(limit);
  if (error) throw new Error("No se ha podido cargar la conversación.");
  return data.reverse().map((m) => ({
    id: m.id,
    role: m.role as JaxMessage["role"],
    content: m.content,
    citations: Array.isArray(m.citations) ? (m.citations as Citation[]) : [],
    actions: ((m.jax_actions ?? []) as (JaxActionView & { created_at: string })[])
      .toSorted((a, b) => a.created_at.localeCompare(b.created_at))
      .map(({ id, kind, summary, status, href }) => ({ id, kind, summary, status, href })),
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
