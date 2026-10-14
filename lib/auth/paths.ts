/** Routes reachable without a session. Everything else requires login. */
export const AUTH_PAGES = ["/login", "/registro"] as const;

export function isAuthPage(pathname: string) {
  return AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Fetched by the browser without session cookies (install metadata). */
const PUBLIC_FILES = ["/manifest.webmanifest"];

export function isPublicPath(pathname: string) {
  return isAuthPage(pathname) || pathname.startsWith("/auth/") || PUBLIC_FILES.includes(pathname);
}
