import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
};

/** Verified current user, or redirect to /login. Must be called inside a Suspense boundary. */
export async function getCurrentUser(): Promise<CurrentUser> {
  // Supabase compares token expiry with Date.now(), which Next forbids while
  // prerendering (incl. runtime prefetch). Run this only at request time.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) {
    redirect("/login");
  }
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}
