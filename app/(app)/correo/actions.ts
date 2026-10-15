"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/user";
import { decryptToken } from "@/lib/mail/crypto";
import { parseFilterInput } from "@/lib/mail/filters";
import { revokeToken } from "@/lib/mail/google";
import { createClient } from "@/lib/supabase/server";
import { parseTaskId as parseId } from "@/lib/tasks/validation";

type FormState = { error?: string; ok?: boolean };

export async function addMailFilter(_prev: FormState, fd: FormData): Promise<FormState> {
  await getCurrentUser();
  const parsed = parseFilterInput(fd);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("mail_filters").insert(parsed.value);
  if (error?.code === "23505") return { error: "Ya tienes ese filtro." };
  if (error) return { error: "No se ha podido añadir el filtro. Inténtalo de nuevo." };
  refresh();
  return { ok: true };
}

export async function deleteMailFilter(fd: FormData): Promise<void> {
  await getCurrentUser();
  const id = parseId(fd.get("id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("mail_filters").delete().eq("id", id);
  refresh();
}

/** Revokes Google's access and forgets the account. Filters are kept for a later reconnection. */
export async function disconnectMail(): Promise<FormState> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.from("mail_accounts").select("refresh_token_enc").maybeSingle();
  if (data) {
    try {
      await revokeToken(decryptToken(data.refresh_token_enc));
    } catch {
      // Undecryptable token: nothing to revoke, still remove the row.
    }
  }
  const { error } = await supabase.from("mail_accounts").delete().not("user_id", "is", null);
  if (error) return { error: "No se ha podido desconectar. Inténtalo de nuevo." };
  refresh();
  return { ok: true };
}
