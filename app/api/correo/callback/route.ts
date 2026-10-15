import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { encryptToken } from "@/lib/mail/crypto";
import { DEFAULT_FILTERS } from "@/lib/mail/filters";
import { STATE_COOKIE, exchangeCode } from "@/lib/mail/google";
import { createClient } from "@/lib/supabase/server";

function sameState(a: string | undefined, b: string | null) {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Google redirects here after consent: store the encrypted refresh token and the starter filters. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const back = (aviso?: string) => {
    const res = NextResponse.redirect(new URL(aviso ? `/correo?aviso=${aviso}` : "/correo", origin));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/correo" });
    return res;
  };

  if (!sameState(request.cookies.get(STATE_COOKIE)?.value, searchParams.get("state"))) return back("error");
  if (searchParams.get("error")) return back("cancelado");
  const code = searchParams.get("code");
  if (!code) return back("error");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.redirect(new URL("/login", origin));

  let account: { refreshToken: string; email: string };
  try {
    account = await exchangeCode(code, origin);
  } catch {
    return back("error");
  }

  const { error } = await supabase
    .from("mail_accounts")
    .upsert({ email: account.email, refresh_token_enc: encryptToken(account.refreshToken), connected_at: new Date().toISOString() });
  if (error) return back("error");

  // Starter junk filters, only the first time (the user may have edited them since).
  const { count } = await supabase.from("mail_filters").select("id", { count: "exact", head: true });
  if (count === 0) await supabase.from("mail_filters").insert(DEFAULT_FILTERS);

  return back();
}
