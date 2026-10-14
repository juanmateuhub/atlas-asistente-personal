export function supabaseEnv() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!rawUrl || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local",
    );
  }
  return { url: projectUrl(rawUrl), key };
}

/**
 * The Supabase client needs the bare project URL. The dashboard often shows the
 * REST endpoint (`…supabase.co/rest/v1/`); a pasted path breaks auth, so keep
 * only the origin.
 */
export function projectUrl(raw: string): string {
  try {
    return new URL(raw.trim()).origin;
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL no es una URL válida (https://<ref>.supabase.co)");
  }
}
