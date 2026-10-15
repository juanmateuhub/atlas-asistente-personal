import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "./crypto";
import type { FilterField, MailFilter } from "./filters";
import { accessTokenFor } from "./google";

export type MailAccount = { email: string; connectedAt: string; refreshTokenEnc: string };

export const getMailAccount = cache(async (): Promise<MailAccount | null> => {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mail_accounts")
    .select("email, connected_at, refresh_token_enc")
    .maybeSingle();
  if (error) throw new Error("No se ha podido cargar la cuenta de correo.");
  return data ? { email: data.email, connectedAt: data.connected_at, refreshTokenEnc: data.refresh_token_enc } : null;
});

export async function listMailFilters(): Promise<MailFilter[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("mail_filters").select("id, field, pattern").order("created_at");
  if (error) throw new Error("No se han podido cargar los filtros.");
  return data.map((f) => ({ id: f.id, field: f.field as FilterField, pattern: f.pattern }));
}

/** One Google access token per request. Throws ReconnectError when the user must connect again. */
export const getMailAccessToken = cache(async (account: MailAccount): Promise<string> => {
  return accessTokenFor(decryptToken(account.refreshTokenEnc));
});
