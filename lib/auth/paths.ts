/** Routes reachable without a session. Everything else requires login. */
export const AUTH_PAGES = ["/login", "/registro"] as const;

export function isAuthPage(pathname: string) {
  return AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Fetched by the browser without session cookies (install metadata, the push service worker). */
const PUBLIC_FILES = ["/manifest.webmanifest", "/sw.js"];

/** Called by pg_cron with a shared secret, not a session (the routes check it). */
const CRON_PREFIX = "/api/cron/";

export function isPublicPath(pathname: string) {
  return isAuthPage(pathname) || pathname.startsWith("/auth/") || PUBLIC_FILES.includes(pathname) || pathname.startsWith(CRON_PREFIX);
}
