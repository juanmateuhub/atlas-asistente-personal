import { describe, expect, it } from "vitest";
import { isAuthPage, isPublicPath } from "@/lib/auth/paths";
import { authErrorMessage, parseCredentials } from "@/lib/auth/validation";

function form(email: string, password: string) {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", password);
  return fd;
}

describe("parseCredentials", () => {
  it("accepts a valid email and password, normalising the email", () => {
    const r = parseCredentials(form("  Ana@Correo.ES ", "contraseña1"));
    expect(r).toEqual({ ok: true, value: { email: "ana@correo.es", password: "contraseña1" } });
  });

  it("rejects an invalid email and keeps it for the form", () => {
    const r = parseCredentials(form("ana@", "contraseña1"));
    expect(r).toMatchObject({ ok: false, email: "ana@" });
  });

  it("rejects passwords shorter than 8 or longer than 72 chars", () => {
    expect(parseCredentials(form("a@b.es", "1234567")).ok).toBe(false);
    expect(parseCredentials(form("a@b.es", "x".repeat(73))).ok).toBe(false);
    expect(parseCredentials(form("a@b.es", "12345678")).ok).toBe(true);
  });
});

describe("authErrorMessage", () => {
  it("maps known Supabase codes to Spanish", () => {
    expect(authErrorMessage("invalid_credentials")).toBe("Correo o contraseña incorrectos.");
  });

  it("falls back to a generic message for unknown codes", () => {
    expect(authErrorMessage("something_new")).toMatch(/Inténtalo de nuevo/);
    expect(authErrorMessage(undefined)).toMatch(/Inténtalo de nuevo/);
  });
});

describe("route access", () => {
  it("treats login, registro and auth callbacks as public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/registro")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });

  it("protects app routes, including look-alike prefixes", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/tareas")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isAuthPage("/auth/callback")).toBe(false);
  });
});

describe("supabase project URL", async () => {
  const { projectUrl } = await import("@/lib/supabase/env");

  it("keeps only the origin, even if the REST path was pasted", () => {
    expect(projectUrl("https://abc123.supabase.co/rest/v1/")).toBe("https://abc123.supabase.co");
    expect(projectUrl(" https://abc123.supabase.co ")).toBe("https://abc123.supabase.co");
  });

  it("rejects values that are not URLs", () => {
    expect(() => projectUrl("sb_secret_xxx")).toThrow(/no es una URL válida/);
  });
});

describe("installable app", () => {
  it("serves the web manifest without a session", () => {
    expect(isPublicPath("/manifest.webmanifest")).toBe(true);
  });
});
