/** Routes reachable without a session. Everything else requires login. */
export const AUTH_PAGES = ["/login", "/registro"] as const;

export function isAuthPage(pathname: string) {
  return AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isPublicPath(pathname: string) {
  return isAuthPage(pathname) || pathname.startsWith("/auth/");
}
