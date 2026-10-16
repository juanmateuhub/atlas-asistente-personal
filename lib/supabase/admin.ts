import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { projectUrl } from "./env";

/**
 * Secret-key client for background jobs only (/api/cron/*): there is no user
 * session there, so it bypasses RLS. Every query must scope rows by user_id
 * explicitly. Never import it from code that runs for a signed-in request.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en el servidor");
  return createSupabaseClient(projectUrl(url), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cron requests carry `Authorization: Bearer <CRON_SECRET>`, sent by pg_cron. */
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
