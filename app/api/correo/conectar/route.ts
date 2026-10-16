import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { STATE_COOKIE, authorizationUrl, mailConfigured } from "@/lib/mail/google";
import { createClient } from "@/lib/supabase/server";

/** Starts the Google sign-in for Gmail and Calendar access. A random state cookie guards the callback. */
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.redirect(new URL("/login", origin));
  if (!mailConfigured()) return NextResponse.redirect(new URL("/correo?aviso=sin-configurar", origin));

  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(authorizationUrl(origin, state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/correo",
    maxAge: 600,
  });
  return response;
}
