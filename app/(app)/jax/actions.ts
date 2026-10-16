"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/user";
import { applyAction, dismissAction, undoAction } from "@/lib/jax/apply";
import type { JaxActionStatus } from "@/lib/jax/conversation";
import { createClient } from "@/lib/supabase/server";
import { parseTaskId as parseId } from "@/lib/tasks/validation";

/** Start over: delete the caller's whole conversation (RLS scopes the delete). */
export async function clearConversation(): Promise<{ error?: string; ok?: boolean }> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("jax_messages").delete().eq("user_id", user.id);
  if (error) return { error: "No se ha podido borrar la conversación. Inténtalo de nuevo." };
  return { ok: true };
}

export type ResolveResult = { status: JaxActionStatus; href?: string | null; error?: string };

/**
 * Act on a change Jax made or proposed. The client only sends the action id:
 * what runs is always the stored, validated action.
 *  - apply: for proposals still pending (mail drafts, older conversations)
 *  - undo: revert an applied change
 *  - dismiss: leave a pending proposal unapplied
 */
export async function resolveJaxAction(actionId: string, decision: "apply" | "undo" | "dismiss"): Promise<ResolveResult> {
  await getCurrentUser();
  const id = parseId(actionId);
  if (!id) return { status: "failed", error: "Acción no válida." };
  const supabase = await createClient();

  const result =
    decision === "apply"
      ? await applyAction(supabase, id)
      : decision === "undo"
        ? await undoAction(supabase, id)
        : await dismissAction(supabase, id);
  if (!result.error) refresh();
  return result;
}

export type Memory = { id: string; content: string };

/** What Jax keeps about the user, for the "Memoria" dialog. */
export async function listMemories(): Promise<Memory[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.from("jax_memories").select("id,content").order("created_at").limit(200);
  return data ?? [];
}

export async function deleteMemory(id: string): Promise<{ ok?: boolean; error?: string }> {
  await getCurrentUser();
  const memoryId = parseId(id);
  if (!memoryId) return { error: "Recuerdo no válido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("jax_memories").delete().eq("id", memoryId).select("id");
  if (error || !data.length) return { error: "No se ha podido borrar. Inténtalo de nuevo." };
  return { ok: true };
}
