import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/mail/crypto";
import { accessTokenFor, hasCalendarListScope, hasCalendarScope } from "@/lib/mail/google";

/** calendarList: Atlas may list the user's calendars (otherwise only the primary one is synced). */
export type GoogleConnection = { userId: string; email: string; token: string; calendar: boolean; calendarList: boolean };

/**
 * The connected Google account (the UJI one) with a fresh access token, or null
 * when there is none. With the user's client RLS picks their row; background
 * jobs pass the admin client and the user id. Throws ReconnectError when Google
 * no longer accepts the refresh token.
 */
export async function googleConnection(supabase: SupabaseClient, userId?: string): Promise<GoogleConnection | null> {
  let query = supabase.from("mail_accounts").select("user_id,email,refresh_token_enc,scopes");
  if (userId) query = query.eq("user_id", userId);
  const { data } = await query.maybeSingle();
  if (!data) return null;
  const token = await accessTokenFor(decryptToken(data.refresh_token_enc));
  return {
    userId: data.user_id,
    email: data.email,
    token,
    calendar: hasCalendarScope(data.scopes),
    calendarList: hasCalendarListScope(data.scopes),
  };
}
