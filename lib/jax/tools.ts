/**
 * Jax's write tools. The model never touches the database: each tool call is
 * turned into a validated *proposal* the user confirms in the UI. Validation
 * reuses the same parsers as the app's forms, so Jax can't store anything the
 * user couldn't store by hand.
 *
 * The model refers to existing items by short refs from the DATOS block
 * (t1, e1, x1, s1, tp1); refs resolve to UUIDs here, so invented ids fail.
 */
import { parseEventInput } from "@/lib/calendar/validation";
import { PRIORITIES, STATUSES } from "@/lib/tasks/types";
import { isValidDate, parseTaskInput } from "@/lib/tasks/validation";
import { parseExamInput, parseSubjectInput, parseTitle, parseDoc } from "@/lib/university/validation";
import { markdownToDoc } from "./markdown-doc";

export type Entity = "task" | "event" | "exam" | "subject" | "topic" | "page";
export type ActionKind = `${Entity}.${"create" | "update" | "delete"}`;

export type Proposal = {
  kind: ActionKind;
  /** create: { values }, update: { id, changes }, delete: { id } — DB column names. */
  payload: { values?: Record<string, unknown>; id?: string; changes?: Record<string, unknown> };
  summary: string;
};

/** Snapshot of existing items the model may reference (from retrieval). */
export type RefItem = { id: string; label: string; values: Record<string, string | number | null> };
export type RefMap = Record<"t" | "e" | "x" | "s" | "tp", Map<string, RefItem>>;

export function emptyRefs(): RefMap {
  return { t: new Map(), e: new Map(), x: new Map(), s: new Map(), tp: new Map() };
}

type Result = { ok: true; proposal: Proposal } | { ok: false; error: string };

const str = { type: "string" } as const;
const date = { type: "string", description: "Fecha YYYY-MM-DD" } as const;
const time = { type: "string", description: "Hora HH:MM (24 h)" } as const;

function schema(properties: Record<string, unknown>, required: string[]) {
  return { type: "object", properties, required, additionalProperties: false };
}

export const TOOL_DECLARATIONS = [
  {
    name: "crear_tarea",
    description: "Crea una tarea.",
    parametersJsonSchema: schema(
      { title: str, priority: { type: "string", enum: [...PRIORITIES] }, due_date: date, notes: str },
      ["title"],
    ),
  },
  {
    name: "editar_tarea",
    description: "Cambia una tarea existente (por su ref tN). Envía solo los campos que cambian. due_date vacío quita la fecha.",
    parametersJsonSchema: schema(
      {
        task: { type: "string", description: "Ref de la tarea, p. ej. t3" },
        title: str,
        priority: { type: "string", enum: [...PRIORITIES] },
        status: { type: "string", enum: [...STATUSES] },
        due_date: date,
        notes: str,
      },
      ["task"],
    ),
  },
  { name: "borrar_tarea", description: "Borra una tarea.", parametersJsonSchema: schema({ task: str }, ["task"]) },
  {
    name: "crear_evento",
    description: "Crea un evento de calendario. Sin start_time es de todo el día.",
    parametersJsonSchema: schema(
      { title: str, date, start_time: time, end_time: time, location: str, notes: str },
      ["title", "date"],
    ),
  },
  {
    name: "editar_evento",
    description: "Cambia un evento existente (ref eN). Envía solo los campos que cambian.",
    parametersJsonSchema: schema(
      { event: str, title: str, date, start_time: time, end_time: time, location: str, notes: str },
      ["event"],
    ),
  },
  { name: "borrar_evento", description: "Borra un evento.", parametersJsonSchema: schema({ event: str }, ["event"]) },
  {
    name: "crear_examen",
    description: "Añade un examen a una asignatura existente (ref sN).",
    parametersJsonSchema: schema(
      { subject: str, title: str, date, time, location: str, grade: { type: "number", minimum: 0, maximum: 10 } },
      ["subject", "title", "date"],
    ),
  },
  {
    name: "editar_examen",
    description: "Cambia un examen existente (ref xN): fecha, hora, lugar, nota… Envía solo lo que cambia.",
    parametersJsonSchema: schema(
      { exam: str, title: str, date, time, location: str, grade: { type: "number", minimum: 0, maximum: 10 } },
      ["exam"],
    ),
  },
  { name: "borrar_examen", description: "Borra un examen.", parametersJsonSchema: schema({ exam: str }, ["exam"]) },
  {
    name: "crear_asignatura",
    description: "Crea una asignatura.",
    parametersJsonSchema: schema({ name: str, description: str }, ["name"]),
  },
  {
    name: "crear_tema",
    description: "Crea un tema dentro de una asignatura existente (ref sN).",
    parametersJsonSchema: schema({ subject: str, title: str }, ["subject", "title"]),
  },
  {
    name: "crear_pagina",
    description:
      "Crea una página de apuntes en un tema existente (ref tpN). content admite párrafos, listas con '- ' y **negrita**.",
    parametersJsonSchema: schema({ topic: str, title: str, content: str }, ["topic", "title"]),
  },
] as const;

export type ToolName = (typeof TOOL_DECLARATIONS)[number]["name"];

// --- helpers -----------------------------------------------------------------

const has = (args: Record<string, unknown>, key: string) => args[key] !== undefined && args[key] !== null;
const text = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

function form(entries: Record<string, unknown>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) if (v !== undefined && v !== null) fd.set(k, text(v));
  return fd;
}

function resolve(refs: RefMap, prefix: keyof RefMap, ref: unknown): RefItem | null {
  return typeof ref === "string" ? (refs[prefix].get(ref.trim()) ?? null) : null;
}

const quote = (s: string) => `«${s}»`;
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, day)));
};

/** Columns that differ from the snapshot, limited to keys the model actually sent. */
function pickChanges(next: Record<string, unknown>, before: Record<string, unknown>, sent: string[]) {
  const changes: Record<string, unknown> = {};
  for (const key of sent) if (key in next && next[key] !== before[key]) changes[key] = next[key];
  return changes;
}

// --- tool call -> proposal ---------------------------------------------------------

export function toProposal(name: string, rawArgs: unknown, refs: RefMap): Result {
  const args = (rawArgs && typeof rawArgs === "object" ? rawArgs : {}) as Record<string, unknown>;
  const fail = (error: string): Result => ({ ok: false, error });

  switch (name as ToolName) {
    case "crear_tarea": {
      const p = parseTaskInput(form({ title: args.title, priority: args.priority ?? "media", dueDate: args.due_date, notes: args.notes }));
      if (!p.ok) return fail(p.error);
      const v = p.value;
      return {
        ok: true,
        proposal: {
          kind: "task.create",
          payload: { values: { title: v.title, priority: v.priority, due_date: v.dueDate, notes: v.notes } },
          summary: `Crear tarea ${quote(v.title)}${v.dueDate ? `, vence ${fmtDate(v.dueDate)}` : ""}, prioridad ${v.priority}`,
        },
      };
    }
    case "editar_tarea": {
      const item = resolve(refs, "t", args.task);
      if (!item) return fail("No encuentro esa tarea.");
      const before = item.values;
      const merged = {
        title: has(args, "title") ? args.title : before.title,
        priority: has(args, "priority") ? args.priority : before.priority,
        status: has(args, "status") ? args.status : before.status,
        dueDate: has(args, "due_date") ? args.due_date : before.due_date,
        notes: has(args, "notes") ? args.notes : "",
      };
      const p = parseTaskInput(form(merged));
      if (!p.ok) return fail(p.error);
      const v = p.value;
      const sent = [
        has(args, "title") && "title",
        has(args, "priority") && "priority",
        has(args, "status") && "status",
        has(args, "due_date") && "due_date",
        has(args, "notes") && "notes",
      ].filter(Boolean) as string[];
      const changes = pickChanges(
        { title: v.title, priority: v.priority, status: v.status, due_date: v.dueDate, notes: v.notes },
        before,
        sent,
      );
      if (Object.keys(changes).length === 0) return fail("No hay nada que cambiar en esa tarea.");
      return {
        ok: true,
        proposal: { kind: "task.update", payload: { id: item.id, changes }, summary: `Editar tarea ${quote(item.label)}: ${describe(changes)}` },
      };
    }
    case "borrar_tarea": {
      const item = resolve(refs, "t", args.task);
      if (!item) return fail("No encuentro esa tarea.");
      return { ok: true, proposal: { kind: "task.delete", payload: { id: item.id }, summary: `Borrar tarea ${quote(item.label)}` } };
    }

    case "crear_evento": {
      const p = parseEventInput(
        form({ title: args.title, date: args.date, startTime: args.start_time, endTime: args.end_time, location: args.location, notes: args.notes }),
      );
      if (!p.ok) return fail(p.error);
      const v = p.value;
      return {
        ok: true,
        proposal: {
          kind: "event.create",
          payload: {
            values: { title: v.title, event_date: v.date, start_time: v.startTime, end_time: v.endTime, location: v.location, notes: v.notes },
          },
          summary: `Crear evento ${quote(v.title)} el ${fmtDate(v.date)}${v.startTime ? ` a las ${v.startTime}` : ", todo el día"}`,
        },
      };
    }
    case "editar_evento": {
      const item = resolve(refs, "e", args.event);
      if (!item) return fail("No encuentro ese evento.");
      const b = item.values;
      const p = parseEventInput(
        form({
          title: has(args, "title") ? args.title : b.title,
          date: has(args, "date") ? args.date : b.event_date,
          startTime: has(args, "start_time") ? args.start_time : b.start_time,
          endTime: has(args, "end_time") ? args.end_time : b.end_time,
          location: has(args, "location") ? args.location : b.location,
          notes: has(args, "notes") ? args.notes : "",
        }),
      );
      if (!p.ok) return fail(p.error);
      const v = p.value;
      const sent = [
        has(args, "title") && "title",
        has(args, "date") && "event_date",
        has(args, "start_time") && "start_time",
        has(args, "end_time") && "end_time",
        has(args, "location") && "location",
        has(args, "notes") && "notes",
      ].filter(Boolean) as string[];
      const changes = pickChanges(
        { title: v.title, event_date: v.date, start_time: v.startTime, end_time: v.endTime, location: v.location, notes: v.notes },
        b,
        sent,
      );
      if (Object.keys(changes).length === 0) return fail("No hay nada que cambiar en ese evento.");
      return {
        ok: true,
        proposal: { kind: "event.update", payload: { id: item.id, changes }, summary: `Editar evento ${quote(item.label)}: ${describe(changes)}` },
      };
    }
    case "borrar_evento": {
      const item = resolve(refs, "e", args.event);
      if (!item) return fail("No encuentro ese evento.");
      return { ok: true, proposal: { kind: "event.delete", payload: { id: item.id }, summary: `Borrar evento ${quote(item.label)}` } };
    }

    case "crear_examen": {
      const subject = resolve(refs, "s", args.subject);
      if (!subject) return fail("No encuentro esa asignatura.");
      const p = parseExamInput(form({ title: args.title, date: args.date, time: args.time, location: args.location, grade: args.grade }));
      if (!p.ok) return fail(p.error);
      const v = p.value;
      return {
        ok: true,
        proposal: {
          kind: "exam.create",
          payload: {
            values: { subject_id: subject.id, title: v.title, exam_date: v.date, exam_time: v.time, location: v.location, grade: v.grade },
          },
          summary: `Añadir examen ${quote(v.title)} de ${subject.label} el ${fmtDate(v.date)}${v.time ? ` a las ${v.time}` : ""}`,
        },
      };
    }
    case "editar_examen": {
      const item = resolve(refs, "x", args.exam);
      if (!item) return fail("No encuentro ese examen.");
      const b = item.values;
      const p = parseExamInput(
        form({
          title: has(args, "title") ? args.title : b.title,
          date: has(args, "date") ? args.date : b.exam_date,
          time: has(args, "time") ? args.time : b.exam_time,
          location: has(args, "location") ? args.location : b.location,
          grade: has(args, "grade") ? args.grade : b.grade,
        }),
      );
      if (!p.ok) return fail(p.error);
      const v = p.value;
      const sent = [
        has(args, "title") && "title",
        has(args, "date") && "exam_date",
        has(args, "time") && "exam_time",
        has(args, "location") && "location",
        has(args, "grade") && "grade",
      ].filter(Boolean) as string[];
      const changes = pickChanges(
        { title: v.title, exam_date: v.date, exam_time: v.time, location: v.location, grade: v.grade },
        b,
        sent,
      );
      if (Object.keys(changes).length === 0) return fail("No hay nada que cambiar en ese examen.");
      return {
        ok: true,
        proposal: { kind: "exam.update", payload: { id: item.id, changes }, summary: `Editar examen ${quote(item.label)}: ${describe(changes)}` },
      };
    }
    case "borrar_examen": {
      const item = resolve(refs, "x", args.exam);
      if (!item) return fail("No encuentro ese examen.");
      return { ok: true, proposal: { kind: "exam.delete", payload: { id: item.id }, summary: `Borrar examen ${quote(item.label)}` } };
    }

    case "crear_asignatura": {
      const p = parseSubjectInput(form({ name: args.name, description: args.description }));
      if (!p.ok) return fail(p.error);
      return {
        ok: true,
        proposal: { kind: "subject.create", payload: { values: p.value }, summary: `Crear asignatura ${quote(p.value.name)}` },
      };
    }
    case "crear_tema": {
      const subject = resolve(refs, "s", args.subject);
      if (!subject) return fail("No encuentro esa asignatura.");
      const t = parseTitle(form({ title: args.title }), "tema");
      if (!t.ok) return fail(t.error);
      return {
        ok: true,
        proposal: {
          kind: "topic.create",
          payload: { values: { subject_id: subject.id, title: t.value } },
          summary: `Crear tema ${quote(t.value)} en ${subject.label}`,
        },
      };
    }
    case "crear_pagina": {
      const topic = resolve(refs, "tp", args.topic);
      if (!topic) return fail("No encuentro ese tema.");
      const t = parseTitle(form({ title: args.title }), "página");
      if (!t.ok) return fail(t.error);
      const doc = parseDoc(markdownToDoc(text(args.content)));
      if (!doc.ok) return fail(doc.error);
      return {
        ok: true,
        proposal: {
          kind: "page.create",
          payload: { values: { topic_id: topic.id, title: t.value, content: doc.value } },
          summary: `Crear página de apuntes ${quote(t.value)} en ${topic.label}`,
        },
      };
    }
    default:
      return fail("Acción desconocida.");
  }
}

const FIELD_LABEL: Record<string, string> = {
  title: "título",
  priority: "prioridad",
  status: "estado",
  due_date: "fecha límite",
  notes: "notas",
  event_date: "fecha",
  start_time: "hora de inicio",
  end_time: "hora de fin",
  exam_date: "fecha",
  exam_time: "hora",
  location: "lugar",
  grade: "nota",
};

function describe(changes: Record<string, unknown>): string {
  return Object.entries(changes)
    .map(([k, v]) => {
      const label = FIELD_LABEL[k] ?? k;
      if (v === null) return `quitar ${label}`;
      const value = typeof v === "string" && isValidDate(v) ? fmtDate(v) : String(v);
      return `${label} → ${value}`;
    })
    .join(", ");
}

// --- apply-time guard --------------------------------------------------------------

const TABLE: Record<Entity, string> = {
  task: "tasks",
  event: "events",
  exam: "exams",
  subject: "subjects",
  topic: "topics",
  page: "pages",
};

/** Columns each action may write. Anything else in a stored payload is refused. */
const WRITABLE: Partial<Record<ActionKind, string[]>> = {
  "task.create": ["title", "priority", "due_date", "notes"],
  "task.update": ["title", "priority", "status", "due_date", "notes"],
  "event.create": ["title", "event_date", "start_time", "end_time", "location", "notes"],
  "event.update": ["title", "event_date", "start_time", "end_time", "location", "notes"],
  "exam.create": ["subject_id", "title", "exam_date", "exam_time", "location", "grade"],
  "exam.update": ["title", "exam_date", "exam_time", "location", "grade"],
  "subject.create": ["name", "description"],
  "topic.create": ["subject_id", "title"],
  "page.create": ["topic_id", "title", "content"],
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ApplyPlan =
  | { op: "insert"; table: string; values: Record<string, unknown> }
  | { op: "update"; table: string; id: string; changes: Record<string, unknown> }
  | { op: "delete"; table: string; id: string };

/** Turns a stored proposal into a DB operation, or null if it doesn't look like one we made. */
export function planAction(kind: string, payload: unknown): ApplyPlan | null {
  const match = /^(task|event|exam|subject|topic|page)\.(create|update|delete)$/.exec(kind);
  if (!match || !payload || typeof payload !== "object") return null;
  const [, entity, op] = match as unknown as [string, Entity, "create" | "update" | "delete"];
  const p = payload as Proposal["payload"];
  const table = TABLE[entity];
  const allowed = WRITABLE[kind as ActionKind] ?? [];
  const onlyAllowed = (obj: unknown) =>
    !!obj && typeof obj === "object" && Object.keys(obj).length > 0 && Object.keys(obj).every((k) => allowed.includes(k));

  if (op === "create") return onlyAllowed(p.values) ? { op: "insert", table, values: p.values! } : null;
  if (typeof p.id !== "string" || !UUID.test(p.id)) return null;
  if (op === "delete") return entity === "task" || entity === "event" || entity === "exam" ? { op: "delete", table, id: p.id } : null;
  return onlyAllowed(p.changes) ? { op: "update", table, id: p.id, changes: p.changes! } : null;
}

// --- undo + links -------------------------------------------------------------------

/** Columns restored when undoing a delete (the row is re-inserted with its id). */
const REINSERT: Partial<Record<string, string[]>> = {
  tasks: ["id", "title", "notes", "priority", "status", "due_date", "completed_at", "created_at"],
  events: ["id", "title", "event_date", "start_time", "end_time", "location", "notes", "created_at"],
  exams: ["id", "subject_id", "title", "exam_date", "exam_time", "location", "grade", "created_at"],
};

export type UndoData = { id?: string; previous?: Record<string, unknown>; row?: Record<string, unknown> };

function pick(obj: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));
}

/** What reverting an applied action means, from the undo data captured when applying. */
export function planUndo(kind: string, undo: unknown): ApplyPlan | null {
  const match = /^(task|event|exam|subject|topic|page)\.(create|update|delete)$/.exec(kind);
  if (!match || !undo || typeof undo !== "object") return null;
  const entity = match[1] as Entity;
  const op = match[2];
  const table = TABLE[entity];
  const u = undo as UndoData;

  if (op === "create") return typeof u.id === "string" && UUID.test(u.id) ? { op: "delete", table, id: u.id } : null;
  if (op === "update") {
    const allowed = WRITABLE[`${entity}.update` as ActionKind] ?? [];
    if (typeof u.id !== "string" || !UUID.test(u.id) || !u.previous) return null;
    const previous = pick(u.previous, allowed);
    return Object.keys(previous).length ? { op: "update", table, id: u.id, changes: previous } : null;
  }
  const columns = REINSERT[table];
  if (!columns || !u.row || typeof u.row.id !== "string" || !UUID.test(u.row.id)) return null;
  return { op: "insert", table, values: pick(u.row, columns) };
}

/** Where to see an item in the app, from its DB row. */
export function hrefFor(entity: Entity, row: Record<string, unknown>, subjectId?: string): string {
  switch (entity) {
    case "task":
      return "/tareas?estado=todas";
    case "event": {
      const date = typeof row.event_date === "string" ? row.event_date : null;
      return date ? `/calendario?mes=${date.slice(0, 7)}&dia=${date}` : "/calendario";
    }
    case "exam":
      return typeof row.subject_id === "string" ? `/universidad/${row.subject_id}` : "/universidad";
    case "subject":
      return typeof row.id === "string" ? `/universidad/${row.id}` : "/universidad";
    case "topic":
      return typeof row.subject_id === "string" ? `/universidad/${row.subject_id}` : "/universidad";
    case "page":
      return subjectId && typeof row.id === "string" ? `/universidad/${subjectId}/paginas/${row.id}` : "/universidad";
  }
}
