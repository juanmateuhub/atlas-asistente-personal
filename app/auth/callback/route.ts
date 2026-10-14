import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for the email confirmation link (PKCE code exchange).
 *
 * Supabase verifies the email *before* redirecting here, so receiving a `code`
 * means the address is already confirmed. The exchange itself can still fail,
 * typically when the link is opened in a different browser than the one used to
 * sign up (the PKCE verifier cookie is missing). That is not an expired link.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (!code) {
    // Supabase sends error / error_code (e.g. otp_expired) when verification failed.
    return NextResponse.redirect(new URL("/login?aviso=enlace-invalido", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?aviso=correo-confirmado", origin));
  }
  return NextResponse.redirect(new URL("/", origin));
}
