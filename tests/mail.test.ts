import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, matchingFilter, normalize, parseFilterInput, type MailFilter } from "@/lib/mail/filters";
import { inboxDate } from "@/lib/mail/format";
import { extractBody, isMessageId, parseFrom, toSummary } from "@/lib/mail/gmail";

const defaults: MailFilter[] = DEFAULT_FILTERS.map((f, i) => ({ ...f, id: String(i) }));
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");

describe("normalize", () => {
  it("ignores case, accents and extra spaces", () => {
    expect(normalize("  Inici de  SESSIÓ nou ")).toBe("inici de sessio nou");
  });
});

describe("matchingFilter (default UJI junk rules)", () => {
  it("hides new sign-in notices", () => {
    const m = { subject: "Inici de sessió nou del vostre compte", from: "UJI <noreply@uji.es>" };
    expect(matchingFilter(m, defaults)?.pattern).toBe("Inici de sessió nou");
  });
  it("hides Enquestes UJI by sender or by subject", () => {
    expect(matchingFilter({ subject: "Valora l'assignatura", from: "Enquestes UJI enquestes@uji.es" }, defaults)).not.toBeNull();
    expect(matchingFilter({ subject: "Enquestes UJI: docència", from: "x@uji.es" }, defaults)).not.toBeNull();
  });
  it("hides assignment submission receipts", () => {
    const m = { subject: "Heu realitzat la tramesa de la tasca Pràctica 2", from: "Aula Virtual <aulavirtual@uji.es>" };
    expect(matchingFilter(m, defaults)).not.toBeNull();
  });
  it("keeps everything else", () => {
    expect(matchingFilter({ subject: "Canvi d'aula de l'examen", from: "Professora <prof@uji.es>" }, defaults)).toBeNull();
  });
  it("respects the field: a subject rule does not look at the sender", () => {
    const only: MailFilter[] = [{ id: "1", field: "subject", pattern: "newsletter" }];
    expect(matchingFilter({ subject: "Hola", from: "Newsletter <n@x.es>" }, only)).toBeNull();
  });
});

describe("parseFilterInput", () => {
  const fd = (field: string, pattern: string) => {
    const f = new FormData();
    f.set("field", field);
    f.set("pattern", pattern);
    return f;
  };
  it("accepts a trimmed rule", () => {
    expect(parseFilterInput(fd("from", "  Biblioteca   UJI "))).toEqual({ ok: true, value: { field: "from", pattern: "Biblioteca UJI" } });
  });
  it("rejects unknown fields and too-short text", () => {
    expect(parseFilterInput(fd("body", "hola")).ok).toBe(false);
    expect(parseFilterInput(fd("subject", "a")).ok).toBe(false);
  });
});

describe("Gmail parsing", () => {
  it("splits display name and address", () => {
    expect(parseFrom('"Secretaria ESTCE" <secre@uji.es>')).toEqual({ name: "Secretaria ESTCE", address: "secre@uji.es" });
    expect(parseFrom("solo@uji.es")).toEqual({ name: "solo@uji.es", address: "solo@uji.es" });
  });

  it("builds a summary with unread flag and unescaped snippet", () => {
    const s = toSummary({
      id: "18f2a",
      threadId: "t",
      labelIds: ["INBOX", "UNREAD"],
      snippet: "L&#39;examen és dilluns &amp; dimarts",
      internalDate: String(Date.UTC(2026, 9, 15, 8, 0)),
      payload: { headers: [{ name: "From", value: "Prof <p@uji.es>" }, { name: "Subject", value: "Examen" }] },
    });
    expect(s).toMatchObject({ subject: "Examen", fromName: "Prof", unread: true, snippet: "L'examen és dilluns & dimarts" });
  });

  it("finds HTML and text bodies in nested parts and lists attachments", () => {
    const body = extractBody({
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [
            { mimeType: "text/plain", body: { data: b64("Hola àlex") } },
            { mimeType: "text/html", body: { data: b64("<p>Hola àlex</p>") } },
          ],
        },
        { mimeType: "application/pdf", filename: "enunciat.pdf", body: { attachmentId: "a1" } },
      ],
    });
    expect(body).toEqual({ html: "<p>Hola àlex</p>", text: "Hola àlex", attachments: ["enunciat.pdf"] });
  });

  it("validates message ids", () => {
    expect(isMessageId("18f2a3b4c5d6e7f8")).toBe(true);
    expect(isMessageId("../../etc")).toBe(false);
  });
});

describe("inboxDate", () => {
  const now = new Date("2026-10-15T10:00:00Z");
  it("shows the time today, day + month this year, full date before", () => {
    expect(inboxDate("2026-10-15T07:41:00Z", now)).toBe("09:41");
    expect(inboxDate("2026-10-03T07:41:00Z", now)).toBe("3 oct");
    expect(inboxDate("2025-12-24T07:41:00Z", now)).toBe("24/12/25");
  });
});
