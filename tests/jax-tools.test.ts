import { describe, expect, it } from "vitest";
import { markdownToDoc } from "@/lib/jax/markdown-doc";
import { TOOL_DECLARATIONS, emptyRefs, planAction, toProposal, type RefMap } from "@/lib/jax/tools";

const ID = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;

function refs(): RefMap {
  const r = emptyRefs();
  r.t.set("t1", { id: ID(1), label: "Entregar práctica", values: { title: "Entregar práctica", priority: "media", status: "pendiente", due_date: "2026-10-15" } });
  r.e.set("e1", { id: ID(2), label: "Tutoría", values: { title: "Tutoría", event_date: "2026-10-20", start_time: "10:00", end_time: "11:00", location: null } });
  r.x.set("x1", { id: ID(3), label: "Parcial", values: { title: "Parcial", exam_date: "2026-11-20", exam_time: null, location: null, grade: null } });
  r.s.set("s1", { id: ID(4), label: "Redes", values: { name: "Redes" } });
  r.tp.set("tp1", { id: ID(5), label: "Tema 1 (Redes)", values: { title: "Tema 1" } });
  return r;
}

describe("tool declarations", () => {
  it("are valid function names with object schemas", () => {
    for (const t of TOOL_DECLARATIONS) {
      expect(t.name).toMatch(/^[a-z_]+$/);
      expect((t.parametersJsonSchema as { type: string }).type).toBe("object");
    }
  });
});

describe("toProposal", () => {
  it("creates a task with validated values", () => {
    const r = toProposal("crear_tarea", { title: "  Repasar Redes ", due_date: "2026-10-15", priority: "alta" }, refs());
    expect(r).toMatchObject({
      ok: true,
      proposal: {
        kind: "task.create",
        payload: { values: { title: "Repasar Redes", priority: "alta", due_date: "2026-10-15", notes: null } },
      },
    });
    if (r.ok) expect(r.proposal.summary).toBe("Crear tarea «Repasar Redes», vence 15 oct, prioridad alta");
  });

  it("rejects invalid input with the same rules as the forms", () => {
    expect(toProposal("crear_tarea", { title: "" }, refs()).ok).toBe(false);
    expect(toProposal("crear_tarea", { title: "a", due_date: "2026-02-30" }, refs()).ok).toBe(false);
    expect(toProposal("crear_evento", { title: "a", date: "2026-10-20", start_time: "11:00", end_time: "10:00" }, refs()).ok).toBe(false);
    expect(toProposal("crear_examen", { subject: "s1", title: "Final", date: "2027-01-20", grade: 11 }, refs()).ok).toBe(false);
  });

  it("resolves refs to UUIDs and refuses unknown or invented ones", () => {
    expect(toProposal("borrar_tarea", { task: "t1" }, refs())).toMatchObject({ ok: true, proposal: { payload: { id: ID(1) } } });
    expect(toProposal("borrar_tarea", { task: "t9" }, refs())).toEqual({ ok: false, error: "No encuentro esa tarea." });
    expect(toProposal("borrar_tarea", { task: ID(1) }, refs()).ok).toBe(false);
    expect(toProposal("crear_tema", { subject: "s7", title: "x" }, refs()).ok).toBe(false);
  });

  it("updates only the fields that changed", () => {
    const r = toProposal("editar_tarea", { task: "t1", status: "hecha", title: "Entregar práctica" }, refs());
    expect(r).toMatchObject({ ok: true, proposal: { kind: "task.update", payload: { id: ID(1), changes: { status: "hecha" } } } });
    if (r.ok) expect(Object.keys(r.proposal.payload.changes!)).toEqual(["status"]);
  });

  it("can clear a due date and move an event while keeping its other fields valid", () => {
    expect(toProposal("editar_tarea", { task: "t1", due_date: "" }, refs())).toMatchObject({
      ok: true,
      proposal: { payload: { changes: { due_date: null } } },
    });
    expect(toProposal("editar_evento", { event: "e1", date: "2026-10-21" }, refs())).toMatchObject({
      ok: true,
      proposal: { payload: { id: ID(2), changes: { event_date: "2026-10-21" } } },
    });
  });

  it("reports when an edit changes nothing", () => {
    expect(toProposal("editar_examen", { exam: "x1", title: "Parcial" }, refs()).ok).toBe(false);
  });

  it("creates exams, topics and note pages under existing parents", () => {
    expect(toProposal("crear_examen", { subject: "s1", title: "Final", date: "2027-01-20", time: "09:30" }, refs())).toMatchObject({
      ok: true,
      proposal: { kind: "exam.create", payload: { values: { subject_id: ID(4), exam_date: "2027-01-20", exam_time: "09:30" } } },
    });
    const page = toProposal("crear_pagina", { topic: "tp1", title: "Resumen", content: "Idea **clave**\n\n- uno\n- dos" }, refs());
    expect(page).toMatchObject({ ok: true, proposal: { kind: "page.create", payload: { values: { topic_id: ID(5), title: "Resumen" } } } });
  });

  it("ignores unknown tools", () => {
    expect(toProposal("borrar_todo", {}, refs())).toEqual({ ok: false, error: "Acción desconocida." });
  });
});

describe("planAction (apply-time guard)", () => {
  it("maps stored proposals to DB operations", () => {
    expect(planAction("task.create", { values: { title: "a", priority: "media" } })).toEqual({
      op: "insert",
      table: "tasks",
      values: { title: "a", priority: "media" },
    });
    expect(planAction("event.delete", { id: ID(2) })).toEqual({ op: "delete", table: "events", id: ID(2) });
  });

  it("refuses columns outside the whitelist, bad ids and unsupported kinds", () => {
    expect(planAction("task.create", { values: { title: "a", user_id: ID(9) } })).toBeNull();
    expect(planAction("task.update", { id: "1 or 1=1", changes: { title: "a" } })).toBeNull();
    expect(planAction("subject.delete", { id: ID(4) })).toBeNull();
    expect(planAction("user.drop", { id: ID(4) })).toBeNull();
    expect(planAction("task.update", { id: ID(1), changes: {} })).toBeNull();
  });
});

describe("markdownToDoc", () => {
  it("turns paragraphs, bold and lists into a Tiptap doc", () => {
    expect(markdownToDoc("Idea **clave**\n\n- uno")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Idea " }, { type: "text", text: "clave", marks: [{ type: "bold" }] }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "uno" }] }] }] },
      ],
    });
  });
});

describe("planUndo", async () => {
  const { planUndo, hrefFor } = await import("@/lib/jax/tools");

  it("undoes a create by deleting the new row", () => {
    expect(planUndo("task.create", { id: ID(1) })).toEqual({ op: "delete", table: "tasks", id: ID(1) });
  });

  it("undoes an update by restoring only whitelisted previous values", () => {
    expect(planUndo("event.update", { id: ID(2), previous: { event_date: "2026-10-20", user_id: ID(9) } })).toEqual({
      op: "update",
      table: "events",
      id: ID(2),
      changes: { event_date: "2026-10-20" },
    });
  });

  it("undoes a delete by re-inserting the saved row with its id", () => {
    const row = { id: ID(3), user_id: ID(9), subject_id: ID(4), title: "Parcial", exam_date: "2026-11-20", grade: null };
    expect(planUndo("exam.delete", { row })).toEqual({
      op: "insert",
      table: "exams",
      values: { id: ID(3), subject_id: ID(4), title: "Parcial", exam_date: "2026-11-20", grade: null },
    });
  });

  it("refuses incomplete or forged undo data", () => {
    expect(planUndo("task.create", {})).toBeNull();
    expect(planUndo("task.update", { id: "x", previous: { title: "a" } })).toBeNull();
    expect(planUndo("subject.delete", { row: { id: ID(4) } })).toBeNull();
  });

  it("links to where the change can be seen", () => {
    expect(hrefFor("event", { event_date: "2026-10-21" })).toBe("/calendario?mes=2026-10&dia=2026-10-21");
    expect(hrefFor("exam", { subject_id: ID(4) })).toBe(`/universidad/${ID(4)}`);
    expect(hrefFor("page", { id: ID(6) }, ID(4))).toBe(`/universidad/${ID(4)}/paginas/${ID(6)}`);
  });
});
