import { describe, expect, it } from "vitest";
import { atlasToGoogle, googleToAtlas } from "@/lib/google/calendar";
import { emptyRefs, planAction, planMail, planUndo, toProposal, type RefMap } from "@/lib/jax/tools";
import { buildRawMessage, parseAddresses } from "@/lib/mail/gmail";
import { hasCalendarScope } from "@/lib/mail/google";
import { toSuggestions, type ScannedMail } from "@/lib/mail/suggestions";
import { instantToZoned, zonedToInstant } from "@/lib/reminders/time";
import { parseReminderInput } from "@/lib/reminders/validation";
import { isPublicPath } from "@/lib/auth/paths";

const ID = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;
const fd = (v: Record<string, string>) => {
  const f = new FormData();
  for (const [k, x] of Object.entries(v)) f.set(k, x);
  return f;
};

describe("Madrid wall time", () => {
  it("converts both ways across summer and winter time", () => {
    expect(zonedToInstant("2026-07-10", "09:00")).toBe("2026-07-10T07:00:00.000Z");
    expect(zonedToInstant("2026-12-10", "09:00")).toBe("2026-12-10T08:00:00.000Z");
    // The day after the change back to winter time (25 Oct 2026).
    expect(zonedToInstant("2026-10-26", "00:30")).toBe("2026-10-25T23:30:00.000Z");
    expect(instantToZoned("2026-10-25T23:30:00.000Z")).toEqual({ date: "2026-10-26", time: "00:30" });
    expect(instantToZoned("2026-07-10T21:15:00.000Z")).toEqual({ date: "2026-07-10", time: "23:15" });
  });
});

describe("reminders", () => {
  const now = new Date("2026-10-16T08:00:00.000Z"); // 10:00 in Madrid
  it("accepts a future time and stores the UTC instant", () => {
    expect(parseReminderInput(fd({ title: " Llamar ", date: "2026-10-16", time: "18:00" }), now)).toEqual({
      ok: true,
      value: { title: "Llamar", remindAt: "2026-10-16T16:00:00.000Z" },
    });
  });
  it("rejects past times, bad dates and empty text", () => {
    expect(parseReminderInput(fd({ title: "x", date: "2026-10-16", time: "09:00" }), now).ok).toBe(false);
    expect(parseReminderInput(fd({ title: "x", date: "2026-02-30", time: "09:00" }), now).ok).toBe(false);
    expect(parseReminderInput(fd({ title: "", date: "2026-10-17", time: "09:00" }), now).ok).toBe(false);
    expect(parseReminderInput(fd({ title: "x", date: "2026-10-17", time: "9:00" }), now).ok).toBe(false);
  });
});

function refs(): RefMap {
  const r = emptyRefs();
  r.r.set("r1", { id: ID(6), label: "Llamar", values: { title: "Llamar" } });
  r.me.set("me1", { id: ID(7), label: "Se llama Juan", values: { content: "Se llama Juan" } });
  r.m.set("m1", { id: "18f2a9c0d1e2", label: "Revisión del examen", values: { from: "profe@uji.es" } });
  return r;
}

describe("Jax tools: reminders, memory and mail", () => {
  it("schedules a reminder in Madrid time", () => {
    const r = toProposal("crear_recordatorio", { text: "Llevar el portátil", date: "2099-03-10", time: "09:00" }, refs());
    expect(r).toMatchObject({
      ok: true,
      proposal: { kind: "reminder.create", payload: { values: { title: "Llevar el portátil", remind_at: "2099-03-10T08:00:00.000Z" } } },
    });
    if (r.ok) expect(r.proposal.summary).toBe("Recordarte «Llevar el portátil» el 10 mar a las 09:00");
  });

  it("cancels reminders and forgets memories only by known refs", () => {
    expect(toProposal("borrar_recordatorio", { reminder: "r1" }, refs())).toMatchObject({ ok: true, proposal: { payload: { id: ID(6) } } });
    expect(toProposal("borrar_recordatorio", { reminder: "r9" }, refs()).ok).toBe(false);
    expect(toProposal("olvidar", { memory: "me1" }, refs())).toMatchObject({ ok: true, proposal: { kind: "memory.delete" } });
  });

  it("remembers new facts, not repeated ones", () => {
    expect(toProposal("recordar", { fact: "  Prefiere   estudiar por la mañana " }, refs())).toMatchObject({
      ok: true,
      proposal: { kind: "memory.create", payload: { values: { content: "Prefiere estudiar por la mañana" } } },
    });
    expect(toProposal("recordar", { fact: "se llama juan" }, refs()).ok).toBe(false);
    expect(toProposal("recordar", { fact: "x".repeat(301) }, refs()).ok).toBe(false);
  });

  it("drafts mail to valid addresses only", () => {
    const ok = toProposal("enviar_correo", { to: "profe@uji.es, al1@uji.es", subject: "Tutoría", body: "Hola" }, refs());
    expect(ok).toMatchObject({ ok: true, proposal: { kind: "mail.send", payload: { mail: { to: ["profe@uji.es", "al1@uji.es"] } } } });
    expect(toProposal("enviar_correo", { to: "Profe <profe@uji.es>", subject: "a", body: "b" }, refs()).ok).toBe(false);
    expect(toProposal("enviar_correo", { to: "profe@uji.es\r\nBcc: x@y.z", subject: "a", body: "b" }, refs()).ok).toBe(false);
  });

  it("drafts replies to a mail ref", () => {
    const r = toProposal("responder_correo", { mail: "m1", body: "Gracias" }, refs());
    expect(r).toMatchObject({
      ok: true,
      proposal: { payload: { mail: { replyTo: "18f2a9c0d1e2", subject: "Re: Revisión del examen", to: ["profe@uji.es"] } } },
    });
    expect(toProposal("responder_correo", { mail: "m5", body: "x" }, refs()).ok).toBe(false);
  });

  it("plans reminder and memory writes, undo included", () => {
    expect(planAction("reminder.create", { values: { title: "x", remind_at: "2099-01-01T00:00:00Z" } })).toMatchObject({ op: "insert", table: "reminders" });
    expect(planAction("reminder.create", { values: { title: "x", sent_at: "now" } })).toBeNull();
    expect(planAction("memory.delete", { id: ID(7) })).toEqual({ op: "delete", table: "jax_memories", id: ID(7) });
    expect(planAction("mail.send", { mail: {} })).toBeNull();
    expect(planUndo("memory.delete", { row: { id: ID(7), content: "Se llama Juan", user_id: "someone" } })).toEqual({
      op: "insert",
      table: "jax_memories",
      values: { id: ID(7), content: "Se llama Juan" },
    });
  });

  it("re-validates stored mail before sending", () => {
    expect(planMail("mail.send", { mail: { to: ["a@uji.es"], subject: "Hola", body: "Texto" } })).toEqual({ to: ["a@uji.es"], subject: "Hola", body: "Texto" });
    expect(planMail("mail.send", { mail: { to: ["a@uji.es>"], subject: "Hola", body: "Texto" } })).toBeNull();
    expect(planMail("mail.send", { mail: { replyTo: "../x", subject: "Re", body: "b" } })).toBeNull();
    expect(planMail("task.create", { mail: { to: ["a@uji.es"], subject: "x", body: "y" } })).toBeNull();
  });
});

describe("outgoing mail", () => {
  it("parses plain address lists", () => {
    expect(parseAddresses("a@uji.es; b@gmail.com")).toEqual(["a@uji.es", "b@gmail.com"]);
    expect(parseAddresses("")).toBeNull();
    expect(parseAddresses("not-an-address")).toBeNull();
  });

  it("builds a UTF-8 reply with thread headers and no header injection", () => {
    const raw = buildRawMessage({
      to: ["profe@uji.es"],
      subject: "Re: Revisión\r\nBcc: evil@x.com",
      body: "Hola,\nGracias.",
      inReplyTo: "<abc@mail.gmail.com>",
      references: "<root@mail.gmail.com>",
    });
    const text = Buffer.from(raw, "base64url").toString("utf8");
    const [head, body] = text.split("\r\n\r\n");
    expect(head).toContain("To: profe@uji.es");
    expect(head).not.toMatch(/^Bcc:/m);
    expect(head).toMatch(/^Subject: =\?UTF-8\?B\?.+\?=$/m);
    expect(head).toContain("In-Reply-To: <abc@mail.gmail.com>");
    expect(head).toContain("References: <root@mail.gmail.com> <abc@mail.gmail.com>");
    expect(Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8")).toBe("Hola,\r\nGracias.");
  });
});

describe("Google Calendar mapping", () => {
  it("maps timed, all-day and Atlas events without an end", () => {
    expect(
      googleToAtlas({
        id: "a",
        summary: "Tutoría",
        location: "TD1201",
        start: { dateTime: "2026-10-20T10:00:00+02:00" },
        end: { dateTime: "2026-10-20T11:30:00+02:00" },
      }),
    ).toEqual({ title: "Tutoría", event_date: "2026-10-20", start_time: "10:00", end_time: "11:30", location: "TD1201", notes: null });
    expect(googleToAtlas({ id: "b", summary: "Fiesta", start: { date: "2026-12-08" }, end: { date: "2026-12-09" } })).toMatchObject({
      event_date: "2026-12-08",
      start_time: null,
      end_time: null,
    });
    expect(
      googleToAtlas({
        id: "c",
        summary: "Sin fin",
        start: { dateTime: "2026-10-20T08:00:00Z" },
        end: { dateTime: "2026-10-20T09:00:00Z" },
        extendedProperties: { private: { atlasNoEnd: "1" } },
      }),
    ).toMatchObject({ start_time: "10:00", end_time: null });
  });

  it("skips cancelled and automatic events, drops ends past midnight", () => {
    expect(googleToAtlas({ id: "d", status: "cancelled", start: { date: "2026-10-20" } })).toBeNull();
    expect(googleToAtlas({ id: "e", eventType: "workingLocation", start: { date: "2026-10-20" } })).toBeNull();
    expect(
      googleToAtlas({ id: "f", summary: "Noche", start: { dateTime: "2026-10-20T21:00:00Z" }, end: { dateTime: "2026-10-21T01:00:00Z" } }),
    ).toMatchObject({ event_date: "2026-10-20", start_time: "23:00", end_time: null });
    expect(googleToAtlas({ id: "g", description: "<b>Aula</b><br>2", start: { date: "2026-10-20" } })).toMatchObject({
      title: "(Sin título)",
      notes: "Aula\n2",
    });
  });

  it("builds Google bodies from Atlas rows", () => {
    const base = { title: "Examen", event_date: "2026-10-20", location: null, notes: null };
    expect(atlasToGoogle({ ...base, start_time: null, end_time: null })).toMatchObject({
      start: { date: "2026-10-20" },
      end: { date: "2026-10-21" },
    });
    expect(atlasToGoogle({ ...base, start_time: "09:00", end_time: null })).toMatchObject({
      start: { dateTime: "2026-10-20T07:00:00.000Z" },
      end: { dateTime: "2026-10-20T08:00:00.000Z" },
      extendedProperties: { private: { atlasNoEnd: "1" } },
    });
    // Round trip keeps "no end".
    const body = atlasToGoogle({ ...base, start_time: "09:00", end_time: null });
    expect(googleToAtlas({ id: "x", ...body })).toMatchObject({ start_time: "09:00", end_time: null });
  });

  it("knows whether the calendar permission was granted", () => {
    expect(hasCalendarScope("openid https://www.googleapis.com/auth/calendar.events")).toBe(true);
    expect(hasCalendarScope("openid https://www.googleapis.com/auth/gmail.modify")).toBe(false);
  });
});

describe("mail suggestions", () => {
  const mails: ScannedMail[] = [
    { ref: "m1", id: "aaaa1111", fromName: "Profe", fromAddress: "profe@uji.es", subject: "Práctica 2", date: "2026-10-16T08:00:00Z", text: "" },
    { ref: "m2", id: "bbbb2222", fromName: "sec@uji.es", fromAddress: "sec@uji.es", subject: "Tutoría", date: "2026-10-16T08:00:00Z", text: "" },
  ];
  const link = (id: string) => `https://mail.google.com/#${id}`;

  it("keeps valid, future, one-per-mail-and-kind items", () => {
    const out = toSuggestions(
      [
        { mail: "m1", kind: "task", title: "Entregar práctica 2", date: "2026-10-23" },
        { mail: "m1", kind: "task", title: "Duplicada", date: "2026-10-24" },
        { mail: "m2", kind: "event", title: "Tutoría", date: "2026-10-20", start_time: "10:00", location: "TD1201" },
        { mail: "m2", kind: "task", title: "Pasada", date: "2026-10-01" },
        { mail: "m9", kind: "task", title: "Inventada", date: "2026-10-30" },
        { mail: "m2", kind: "event", title: "Hora mala", date: "2026-10-21", start_time: "25:00" },
      ],
      mails,
      "2026-10-16",
      link,
    );
    expect(out.map((s) => [s.gmail_id, s.kind, s.payload.title])).toEqual([
      ["aaaa1111", "task", "Entregar práctica 2"],
      ["bbbb2222", "event", "Tutoría"],
    ]);
    expect(out[0].payload).toMatchObject({ due_date: "2026-10-23", priority: "media" });
    expect(String(out[0].payload.notes)).toContain("https://mail.google.com/#aaaa1111");
    expect(out[1].summary).toBe("Tutoría · mar, 20 oct a las 10:00 · TD1201");
    expect(out[1].mail_from).toBe("sec@uji.es");
  });

  it("survives a malformed answer", () => {
    expect(toSuggestions(null as never, mails, "2026-10-16", link)).toEqual([]);
  });
});

describe("public paths", () => {
  it("lets pg_cron and the service worker through the session check", () => {
    expect(isPublicPath("/api/cron/recordatorios")).toBe(true);
    expect(isPublicPath("/sw.js")).toBe(true);
    expect(isPublicPath("/api/jax")).toBe(false);
  });
});

describe("calendar duplicates", () => {
  it("treats the same title, day and times as one appointment", async () => {
    const { fingerprint } = await import("@/lib/calendar/google-sync");
    const a = { title: "Redes  de Computadores", event_date: "2026-10-20", start_time: "09:00", end_time: "11:00", location: "TD1", notes: null };
    expect(fingerprint(a)).toBe(fingerprint({ ...a, title: "redes de computadores", location: "TD2" }));
    expect(fingerprint(a)).not.toBe(fingerprint({ ...a, start_time: "11:00", end_time: "13:00" }));
  });
});
