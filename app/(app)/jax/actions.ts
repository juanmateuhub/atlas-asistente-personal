"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/user";
import { applyAction, undoAction } from "@/lib/jax/apply";
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
 *  - apply: for proposals still pending (older conversations)
 *  - undo: revert an applied change
 */
export async function resolveJaxAction(actionId: string, decision: "apply" | "undo"): Promise<ResolveResult> {
  await getCurrentUser();
  const id = parseId(actionId);
  if (!id) return { status: "failed", error: "Acción no válida." };
  const supabase = await createClient();

  const result = decision === "apply" ? await applyAction(supabase, id) : await undoAction(supabase, id);
  if (!result.error) refresh();
  return result;
}
