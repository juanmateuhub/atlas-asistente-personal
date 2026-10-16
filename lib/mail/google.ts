import "server-only";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.modify";
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
export const CALENDAR_LIST_SCOPE = "https://www.googleapis.com/auth/calendar.calendarlist.readonly";

/**
 * gmail.modify: read the mailbox, change labels (Atlas only removes UNREAD when a
 * message is opened) and send the mail the user confirms; it cannot delete mail for
 * good. calendar.events: two-way sync of the primary calendar, and reading the
 * events of the other calendars the user shows (e.g. the UJI timetable), which
 * calendarlist.readonly lets Atlas find. Plus the address.
 */
export const GOOGLE_SCOPES = ["openid", "email", GMAIL_SCOPE, CALENDAR_SCOPE, CALENDAR_LIST_SCOPE];

/** The calendar permission is optional: Google lets the user untick it on the consent screen. */
export function hasCalendarScope(scopes: string): boolean {
  return scopes.split(" ").includes(CALENDAR_SCOPE);
}

/** Without it only the primary calendar is synced. */
export function hasCalendarListScope(scopes: string): boolean {
  return scopes.split(" ").includes(CALENDAR_LIST_SCOPE);
}

export const STATE_COOKIE = "atlas_mail_oauth_state";

/** Google answered that the refresh token is no longer valid (revoked, expired, password change). */
export class ReconnectError extends Error {}

function env() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en .env.local");
  return { clientId, clientSecret };
}

export function mailConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.MAIL_TOKEN_KEY);
}

export const redirectUri = (origin: string) => `${origin}/api/correo/callback`;

export function authorizationUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: env().clientId,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    // offline + consent: Google returns a refresh token every time.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    hd: "uji.es",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; id_token?: string; scope?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = env();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse & { error?: string };
  if (json.error === "invalid_grant") throw new ReconnectError("invalid_grant");
  if (!res.ok || !json.access_token) throw new Error(`Google token ${res.status} ${json.error ?? ""}`);
  return json;
}

/** Code → tokens. The email comes from the ID token, which arrives straight from Google over TLS. */
export async function exchangeCode(code: string, origin: string) {
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri(origin) });
  if (!t.refresh_token) throw new Error("Google no ha devuelto refresh token");
  if (!t.scope?.split(" ").includes(GMAIL_SCOPE)) throw new Error("Falta el permiso de Gmail");
  const payload = JSON.parse(Buffer.from((t.id_token ?? "").split(".")[1] ?? "", "base64url").toString("utf8") || "{}");
  if (typeof payload.email !== "string") throw new Error("Google no ha devuelto el correo");
  return { refreshToken: t.refresh_token, email: payload.email as string, scopes: t.scope };
}

export async function accessTokenFor(refreshToken: string): Promise<string> {
  const t = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
  return t.access_token;
}

/** Best effort: the account is removed from Atlas even if Google is unreachable. */
export async function revokeToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?${new URLSearchParams({ token })}`, { method: "POST" }).catch(() => {});
}
