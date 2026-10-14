import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hrefFor, planAction, planUndo, type Entity, type UndoData } from "./tools";

export type ApplyOutcome = { status: "applied" | "failed"; href?: string; error?: string };

const FAILED = "No se ha podido aplicar. Puede que el elemento ya no exista.";

/**
 * Apply a stored Jax action. Claims it (pending → applied) so it runs once,
 * captures undo data from the DB right before changing anything, then records
 * where the user can see the result.
 */
export async function applyAction(supabase: SupabaseClient, actionId: string): Promise<ApplyOutcome> {
  const { data: claimed } = await supabase
    .from("jax_actions")
    .update({ status: "applied", resolved_at: new Date().toISOString() })
    .eq("id", actionId)
    .eq("status", "pending")
    .select("kind,payload");
  const action = claimed?.[0];
  if (!action) return { status: "failed", error: "Este cambio ya no está pendiente." };

  const fail = async (error = FAILED): Promise<ApplyOutcome> => {
    await supabase.from("jax_actions").update({ status: "failed" }).eq("id", actionId);
    return { status: "failed", error };
  };

  const plan = planAction(action.kind, action.payload);
  if (!plan) return fail();
  const entity = action.kind.split(".")[0] as Entity;

  let undo: UndoData;
  let row: Record<string, unknown>;

  if (plan.op === "insert") {
    const values = { ...plan.values };
    // New topics/pages go to the end of their list, like when created by hand.
    if (plan.table === "topics" || plan.table === "pages") {
      const parent = plan.table === "topics" ? "subject_id" : "topic_id";
      const { count } = await supabase
        .from(plan.table)
        .select("id", { count: "exact", head: true })
        .eq(parent, values[parent] as string);
      values.position = count ?? 0;
    }
    const { data, error } = await supabase.from(plan.table).insert(values).select("*").single();
    if (error || !data) return fail();
    row = data;
    undo = { id: data.id };
  } else if (plan.op === "update") {
    const { data: before } = await supabase.from(plan.table).select("*").eq("id", plan.id).maybeSingle();
    if (!before) return fail();
    const { data, error } = await supabase.from(plan.table).update(plan.changes).eq("id", plan.id).select("*");
    if (error || !data?.length) return fail();
    row = data[0];
    undo = {
      id: plan.id,
      previous: Object.fromEntries(Object.keys(plan.changes).map((k) => [k, (before as Record<string, unknown>)[k]])),
    };
  } else {
    const { data: before } = await supabase.from(plan.table).select("*").eq("id", plan.id).maybeSingle();
    if (!before) return fail();
    const { data, error } = await supabase.from(plan.table).delete().eq("id", plan.id).select("id");
    if (error || !data?.length) return fail();
    row = before;
    undo = { row: before };
  }

  let subjectId: string | undefined;
  if (entity === "page" && typeof row.topic_id === "string") {
    const { data: topic } = await supabase.from("topics").select("subject_id").eq("id", row.topic_id).maybeSingle();
    subjectId = topic?.subject_id;
  }
  const href = plan.op === "delete" && entity === "task" ? "/tareas" : hrefFor(entity, row, subjectId);

  await supabase.from("jax_actions").update({ undo, href }).eq("id", actionId);
  return { status: "applied", href };
}

export type UndoOutcome = { status: "undone" | "applied"; error?: string };

/** Revert an applied action using the undo data captured when it ran. */
export async function undoAction(supabase: SupabaseClient, actionId: string): Promise<UndoOutcome> {
  const { data: claimed } = await supabase
    .from("jax_actions")
    .update({ status: "undone", resolved_at: new Date().toISOString() })
    .eq("id", actionId)
    .eq("status", "applied")
    .select("kind,undo");
  const action = claimed?.[0];
  if (!action) return { status: "applied", error: "Este cambio ya no se puede deshacer." };

  const plan = planUndo(action.kind, action.undo);
  let ok = false;
  if (plan?.op === "delete") {
    const { error } = await supabase.from(plan.table).delete().eq("id", plan.id);
    ok = !error;
  } else if (plan?.op === "update") {
    const { data, error } = await supabase.from(plan.table).update(plan.changes).eq("id", plan.id).select("id");
    ok = !error && !!data?.length;
  } else if (plan?.op === "insert") {
    const { error } = await supabase.from(plan.table).insert(plan.values);
    ok = !error;
  }

  if (!ok) {
    await supabase.from("jax_actions").update({ status: "applied" }).eq("id", actionId);
    return { status: "applied", error: "No se ha podido deshacer. Puede que ya se haya cambiado a mano." };
  }
  return { status: "undone" };
}
