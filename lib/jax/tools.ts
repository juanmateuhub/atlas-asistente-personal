/**
 * Jax's write tools. The model never touches the database: each tool call is
 * turned into a validated *proposal* the user confirms in the UI. Validation
 * reuses the same parsers as the app's forms, so Jax can't store anything the
 * user couldn't store by hand.
 *
 * The model refers to existing items by short refs from the DATOS block
 * (t1, e1, x1, s1, tp1, r1, me1, m1, w1, bw1); refs resolve to ids here, so invented ids fail.
 * Muscle mappings are found by exercise name (refs.mu is keyed by exercise key).
 *
 * Sending mail is the one change that is never applied on its own: it can't be
 * undone and it reaches other people, so it waits for the user's confirmation.
 */
import { parseEventInput } from "@/lib/calendar/validation";
import { exerciseKey, isMuscle, MUSCLE_IDS, muscleLabel, type MuscleId } from "@/lib/fitness/muscles";
import { formatKg, formatSets } from "@/lib/fitness/stats";
import { asExercises, type Exercise } from "@/lib/fitness/types";
import {
  BODY_WEIGHT_MAX,
  BODY_WEIGHT_MIN,
  cleanExerciseName,
  expandSets,
  parseExercises,
  parseNumber,
  SETS_MAX,
  TITLE_MAX as WORKOUT_TITLE_MAX,
} from "@/lib/fitness/validation";
import { parseAddresses } from "@/lib/mail/gmail";
import { instantToZoned } from "@/lib/reminders/time";
import { parseReminderInput } from "@/lib/reminders/validation";
import { PRIORITIES, STATUSES } from "@/lib/tasks/types";
import { isValidDate, parseTaskInput } from "@/lib/tasks/validation";
import { parseExamInput, parseSubjectInput, parseTitle, parseDoc } from "@/lib/university/validation";
import { markdownToDoc } from "./markdown-doc";

export type Entity =
  | "task"
  | "event"
  | "exam"
  | "subject"
  | "topic"
  | "page"
  | "reminder"
  | "memory"
  | "workout"
  | "routine"
  | "weight"
  | "muscle";
export type ActionKind = `${Entity}.${"create" | "update" | "delete"}` | "mail.send";

/** A message Jax wrote; replyTo is the Gmail id of the message being answered. */
export type MailDraft = { to: string[]; subject: string; body: string; replyTo?: string };

export const MEMORY_MAX = 300;
export const MAIL_SUBJECT_MAX = 200;
export const MAIL_BODY_MAX = 10_000;

export type Proposal = {
  kind: ActionKind;
  /** create: { values }, update: { id, changes }, delete: { id } — DB column names. mail.send: { mail }. */
  payload: { values?: Record<string, unknown>; id?: string; changes?: Record<string, unknown>; mail?: MailDraft };
  summary: string;
};

/** Snapshot of existing items the model may reference (from retrieval). */
export type RefItem = { id: string; label: string; values: Record<string, string | number | null> };
export type RefMap = Record<"t" | "e" | "x" | "s" | "tp" | "r" | "me" | "m" | "w" | "bw" | "mu", Map<string, RefItem>>;

export function emptyRefs(): RefMap {
  return {
    t: new Map(),
    e: new Map(),
    x: new Map(),
    s: new Map(),
    tp: new Map(),
    r: new Map(),
    me: new Map(),
    m: new Map(),
    w: new Map(),
    bw: new Map(),
    mu: new Map(),
  };
}

type Result = { ok: true; proposal: Proposal } | { ok: false; error: string };

const str = { type: "string" } as const;
const date = { type: "string", description: "Fecha YYYY-MM-DD" } as const;
const time = { type: "string", description: "Hora HH:MM (24 h)" } as const;

function schema(properties: Record<string, unknown>, required: string[]) {
  return { type: "object", properties, required, additionalProperties: false };
}

/** Exercises as "sets × reps at kg"; several entries of one exercise for uneven sets. */
const exercisesParam = {
  type: "array",
  description:
    "Ejercicios. «3x8 a 60 kg» = sets 3, reps 8, weight_kg 60. Sin weight_kg = con el peso corporal. double true si los kg son por mancuerna o por lado (dos mancuernas, unilateral): cuentan el doble.",
  items: schema(
    {
      name: { type: "string", description: "Nombre del ejercicio, p. ej. Press banca" },
      sets: { type: "integer", minimum: 1, maximum: SETS_MAX },
      reps: { type: "integer", minimum: 0, maximum: 1000 },
      weight_kg: { type: "number", minimum: 0, maximum: 1000 },
      double: { type: "boolean" },
    },
    ["name", "sets", "reps"],
  ),
} as const;

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
  {
    name: "crear_recordatorio",
    description: "Programa un aviso en el móvil del usuario a una fecha y hora (hora de Madrid).",
    parametersJsonSchema: schema(
      { text: { type: "string", description: "Qué hay que recordar, en pocas palabras" }, date, time },
      ["text", "date", "time"],
    ),
  },
  {
    name: "borrar_recordatorio",
    description: "Cancela un recordatorio existente (ref rN).",
    parametersJsonSchema: schema({ reminder: str }, ["reminder"]),
  },
  {
    name: "recordar",
    description:
      "Guarda en tu memoria a largo plazo un dato duradero sobre el usuario (preferencias, horarios, personas, metas). Una frase corta en tercera persona.",
    parametersJsonSchema: schema(
      { fact: { type: "string", description: "P. ej. «Prefiere estudiar por las mañanas»" } },
      ["fact"],
    ),
  },
  {
    name: "olvidar",
    description: "Borra un dato de tu memoria (ref meN).",
    parametersJsonSchema: schema({ memory: str }, ["memory"]),
  },
  {
    name: "apuntar_entreno",
    description:
      "Apunta ejercicios hechos en el gimnasio. Si ese día ya hay un entreno (ref wN en ENTRENOS), se añaden a él; si no, se crea uno.",
    parametersJsonSchema: schema(
      { date, exercises: exercisesParam, title: { type: "string", description: "Nombre del entreno si es nuevo, p. ej. Pierna" }, notes: str },
      ["date", "exercises"],
    ),
  },
  { name: "borrar_entreno", description: "Borra un entreno (ref wN).", parametersJsonSchema: schema({ workout: str }, ["workout"]) },
  {
    name: "crear_rutina",
    description: "Crea una rutina de entreno (plantilla con ejercicios y series objetivo).",
    parametersJsonSchema: schema({ name: str, exercises: exercisesParam, notes: str }, ["name", "exercises"]),
  },
  {
    name: "registrar_peso",
    description: "Apunta el peso corporal del usuario en kg. Si ese día ya hay uno, lo cambia.",
    parametersJsonSchema: schema(
      { date, weight_kg: { type: "number", minimum: BODY_WEIGHT_MIN, maximum: BODY_WEIGHT_MAX } },
      ["date", "weight_kg"],
    ),
  },
  {
    name: "asignar_musculos",
    description:
      "Indica qué grupos musculares trabaja un ejercicio (el primero es el principal; el resto cuenta la mitad en el volumen). Cambia lo que hubiera.",
    parametersJsonSchema: schema(
      {
        exercise: { type: "string", description: "Nombre del ejercicio tal como aparece en ENTRENOS" },
        muscles: { type: "array", items: { type: "string", enum: [...MUSCLE_IDS] }, minItems: 1, maxItems: 4 },
      },
      ["exercise", "muscles"],
    ),
  },
  {
    name: "enviar_correo",
    description: "Prepara un correo nuevo desde la cuenta UJI del usuario. No se envía hasta que el usuario lo confirme.",
    parametersJsonSchema: schema(
      {
        to: { type: "string", description: "Direcciones separadas por comas" },
        subject: str,
        body: { type: "string", description: "Texto del correo, con saludo y despedida" },
      },
      ["to", "subject", "body"],
    ),
  },
  {
    name: "responder_correo",
    description: "Prepara la respuesta a un correo de CORREO UJI (ref mN). No se envía hasta que el usuario lo confirme.",
    parametersJsonSchema: schema({ mail: str, body: { type: "string", description: "Texto de la respuesta" } }, ["mail", "body"]),
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

/** Jax's "n × reps at kg" entries as validated exercises; the same exercise twice is merged. */
function toExercises(raw: unknown): { ok: true; value: Exercise[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "Dime qué ejercicios has hecho." };
  const expanded = raw.map((item) => {
    const e = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const sets = parseNumber(e.sets);
    const n = sets !== null && Number.isInteger(sets) && sets >= 1 && sets <= SETS_MAX ? sets : 0;
    const weight = e.weight_kg === undefined || e.weight_kg === null ? null : parseNumber(e.weight_kg);
    // Invalid numbers are kept as -1 so parseExercises reports them.
    const reps = parseNumber(e.reps) ?? -1;
    return {
      name: text(e.name),
      sets: n ? expandSets(n, reps, weight ?? null) : [{ reps: -1, weight: null }],
      ...(e.double === true && { double: true as const }),
    };
  });
  const parsed = parseExercises(mergeExercises([], expanded));
  if (!parsed.ok) return parsed;
  if (parsed.value.length === 0) return { ok: false, error: "Dime qué ejercicios has hecho." };
  return parsed;
}

/** Adds `extra` to `base`; sets of an exercise already there go after its own. */
export function mergeExercises(base: Exercise[], extra: Exercise[]): Exercise[] {
  const out = base.map((e) => ({ ...e, sets: [...e.sets] }));
  for (const e of extra) {
    const name = cleanExerciseName(e.name);
    const same = out.find((o) => o.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"));
    if (same) {
      same.sets.push(...e.sets);
      if (e.double) same.double = true;
    } else out.push({ name, sets: [...e.sets], ...(e.double && { double: true as const }) });
  }
  return out;
}

const describeExercises = (exercises: Exercise[]) =>
  exercises.map((e) => `${e.name} ${formatSets(e.sets)}${e.double ? " por lado" : ""}`).join("; ");
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

    case "crear_recordatorio": {
      const p = parseReminderInput(form({ title: args.text, date: args.date, time: args.time }));
      if (!p.ok) return fail(p.error);
      const at = instantToZoned(p.value.remindAt);
      return {
        ok: true,
        proposal: {
          kind: "reminder.create",
          payload: { values: { title: p.value.title, remind_at: p.value.remindAt } },
          summary: `Recordarte ${quote(p.value.title)} el ${fmtDate(at.date)} a las ${at.time}`,
        },
      };
    }
    case "borrar_recordatorio": {
      const item = resolve(refs, "r", args.reminder);
      if (!item) return fail("No encuentro ese recordatorio.");
      return {
        ok: true,
        proposal: { kind: "reminder.delete", payload: { id: item.id }, summary: `Cancelar el recordatorio ${quote(item.label)}` },
      };
    }

    case "recordar": {
      const fact = text(args.fact).replace(/\s+/g, " ").trim();
      if (fact.length < 2) return fail("No sé qué tengo que recordar.");
      if (fact.length > MEMORY_MAX) return fail(`Lo que recuerdo no puede pasar de ${MEMORY_MAX} caracteres.`);
      for (const m of refs.me.values()) {
        if (m.label.toLowerCase() === fact.toLowerCase()) return fail("Eso ya lo tengo en la memoria.");
      }
      return { ok: true, proposal: { kind: "memory.create", payload: { values: { content: fact } }, summary: `Recordar: ${fact}` } };
    }
    case "olvidar": {
      const item = resolve(refs, "me", args.memory);
      if (!item) return fail("No encuentro eso en mi memoria.");
      return { ok: true, proposal: { kind: "memory.delete", payload: { id: item.id }, summary: `Olvidar: ${item.label}` } };
    }

    case "apuntar_entreno": {
      const day = text(args.date).trim();
      if (!isValidDate(day)) return fail("Necesito la fecha del entreno.");
      const ex = toExercises(args.exercises);
      if (!ex.ok) return fail(ex.error);
      const existing = [...refs.w.values()].find((w) => w.values.workout_date === day);
      if (existing) {
        const before = asExercises(JSON.parse(String(existing.values.exercises ?? "[]")));
        const merged = parseExercises(mergeExercises(before, ex.value));
        if (!merged.ok) return fail(merged.error);
        return {
          ok: true,
          proposal: {
            kind: "workout.update",
            payload: { id: existing.id, changes: { exercises: merged.value } },
            summary: `Añadir a ${quote(existing.label)}: ${describeExercises(ex.value)}`,
          },
        };
      }
      const title = text(args.title).replace(/\s+/g, " ").trim().slice(0, WORKOUT_TITLE_MAX) || "Entreno";
      const notes = text(args.notes).trim().slice(0, 2000) || null;
      return {
        ok: true,
        proposal: {
          kind: "workout.create",
          payload: { values: { title, workout_date: day, exercises: ex.value, notes } },
          summary: `Apuntar entreno ${quote(title)} el ${fmtDate(day)}: ${describeExercises(ex.value)}`,
        },
      };
    }
    case "borrar_entreno": {
      const item = resolve(refs, "w", args.workout);
      if (!item) return fail("No encuentro ese entreno.");
      return {
        ok: true,
        proposal: {
          kind: "workout.delete",
          payload: { id: item.id },
          summary: `Borrar entreno ${quote(item.label)} del ${fmtDate(String(item.values.workout_date ?? ""))}`,
        },
      };
    }
    case "crear_rutina": {
      const name = text(args.name).replace(/\s+/g, " ").trim();
      if (!name || name.length > WORKOUT_TITLE_MAX) return fail("Dime cómo se llama la rutina.");
      const ex = toExercises(args.exercises);
      if (!ex.ok) return fail(ex.error);
      const notes = text(args.notes).trim().slice(0, 2000) || null;
      return {
        ok: true,
        proposal: {
          kind: "routine.create",
          payload: { values: { name, exercises: ex.value, notes } },
          summary: `Crear rutina ${quote(name)}: ${describeExercises(ex.value)}`,
        },
      };
    }
    case "registrar_peso": {
      const day = text(args.date).trim();
      if (!isValidDate(day)) return fail("Necesito la fecha.");
      const kg = parseNumber(args.weight_kg);
      if (kg === null || kg < BODY_WEIGHT_MIN || kg > BODY_WEIGHT_MAX) return fail("Ese peso no es válido.");
      const weight = Math.round(kg * 100) / 100;
      const existing = [...refs.bw.values()].find((w) => w.values.measured_on === day);
      if (existing) {
        if (Number(existing.values.weight_kg) === weight) return fail("Ese peso ya está apuntado.");
        return {
          ok: true,
          proposal: {
            kind: "weight.update",
            payload: { id: existing.id, changes: { weight_kg: weight } },
            summary: `Cambiar tu peso del ${fmtDate(day)}: ${formatKg(Number(existing.values.weight_kg))} → ${formatKg(weight)}`,
          },
        };
      }
      return {
        ok: true,
        proposal: {
          kind: "weight.create",
          payload: { values: { measured_on: day, weight_kg: weight } },
          summary: `Apuntar tu peso: ${formatKg(weight)} el ${fmtDate(day)}`,
        },
      };
    }

    case "asignar_musculos": {
      const name = text(args.exercise).replace(/\s+/g, " ").trim();
      const key = exerciseKey(name);
      if (!key) return fail("Dime de qué ejercicio se trata.");
      const muscles = [...new Set(Array.isArray(args.muscles) ? args.muscles.filter(isMuscle) : [])].slice(0, 4) as MuscleId[];
      if (!muscles.length) return fail("Dime qué músculos trabaja.");
      const summary = `${name}: ${muscles.map(muscleLabel).join(", ")}`;
      const existing = refs.mu.get(key);
      if (existing) {
        if (existing.values.muscles === muscles.join(",")) return fail("Ese ejercicio ya tiene esos músculos.");
        return { ok: true, proposal: { kind: "muscle.update", payload: { id: existing.id, changes: { muscles } }, summary: `Cambiar músculos de ${summary}` } };
      }
      return {
        ok: true,
        proposal: { kind: "muscle.create", payload: { values: { exercise_key: key, muscles } }, summary: `Asignar músculos a ${summary}` },
      };
    }

    case "enviar_correo": {
      const to = parseAddresses(text(args.to));
      if (!to) return fail("Necesito direcciones de correo válidas para enviarlo.");
      const subject = text(args.subject).replace(/[\r\n]+/g, " ").trim();
      const body = text(args.body).trim();
      if (!subject || subject.length > MAIL_SUBJECT_MAX) return fail("El asunto del correo no es válido.");
      if (!body || body.length > MAIL_BODY_MAX) return fail("El texto del correo no es válido.");
      return {
        ok: true,
        proposal: {
          kind: "mail.send",
          payload: { mail: { to, subject, body } },
          summary: `Enviar a ${to.join(", ")}: ${quote(subject)}`,
        },
      };
    }
    case "responder_correo": {
      const item = resolve(refs, "m", args.mail);
      if (!item) return fail("No encuentro ese correo.");
      const body = text(args.body).trim();
      if (!body || body.length > MAIL_BODY_MAX) return fail("El texto de la respuesta no es válido.");
      const from = String(item.values.from ?? "");
      const subject = /^re:/i.test(item.label) ? item.label : `Re: ${item.label}`;
      return {
        ok: true,
        proposal: {
          kind: "mail.send",
          // Gmail decides the real recipient and thread when sending; these are for the preview.
          payload: { mail: { to: from ? [from] : [], subject, body, replyTo: item.id } },
          summary: `Responder a ${from || "el correo"}: ${quote(item.label)}`,
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
  reminder: "reminders",
  memory: "jax_memories",
  workout: "workouts",
  routine: "workout_routines",
  weight: "body_weights",
  muscle: "exercise_muscles",
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
  "reminder.create": ["title", "remind_at"],
  "memory.create": ["content"],
  "workout.create": ["title", "workout_date", "exercises", "notes"],
  "workout.update": ["exercises"],
  "routine.create": ["name", "exercises", "notes"],
  "weight.create": ["measured_on", "weight_kg"],
  "weight.update": ["weight_kg"],
  "muscle.create": ["exercise_key", "muscles"],
  "muscle.update": ["muscles"],
};

const DELETABLE = new Set<Entity>(["task", "event", "exam", "reminder", "memory", "workout"]);
const ENTITY_KIND = /^(task|event|exam|subject|topic|page|reminder|memory|workout|routine|weight|muscle)\.(create|update|delete)$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ApplyPlan =
  | { op: "insert"; table: string; values: Record<string, unknown> }
  | { op: "update"; table: string; id: string; changes: Record<string, unknown> }
  | { op: "delete"; table: string; id: string };

/** Turns a stored proposal into a DB operation, or null if it doesn't look like one we made. */
export function planAction(kind: string, payload: unknown): ApplyPlan | null {
  const match = ENTITY_KIND.exec(kind);
  if (!match || !payload || typeof payload !== "object") return null;
  const [, entity, op] = match as unknown as [string, Entity, "create" | "update" | "delete"];
  const p = payload as Proposal["payload"];
  const table = TABLE[entity];
  const allowed = WRITABLE[kind as ActionKind] ?? [];
  const onlyAllowed = (obj: unknown) =>
    !!obj && typeof obj === "object" && Object.keys(obj).length > 0 && Object.keys(obj).every((k) => allowed.includes(k));

  if (op === "create") return onlyAllowed(p.values) ? { op: "insert", table, values: p.values! } : null;
  if (typeof p.id !== "string" || !UUID.test(p.id)) return null;
  if (op === "delete") return DELETABLE.has(entity) ? { op: "delete", table, id: p.id } : null;
  return onlyAllowed(p.changes) ? { op: "update", table, id: p.id, changes: p.changes! } : null;
}

// --- undo + links -------------------------------------------------------------------

/** Columns restored when undoing a delete (the row is re-inserted with its id). */
const REINSERT: Partial<Record<string, string[]>> = {
  tasks: ["id", "title", "notes", "priority", "status", "due_date", "completed_at", "created_at"],
  events: ["id", "title", "event_date", "start_time", "end_time", "location", "notes", "created_at"],
  exams: ["id", "subject_id", "title", "exam_date", "exam_time", "location", "grade", "created_at"],
  reminders: ["id", "title", "remind_at", "sent_at", "created_at"],
  jax_memories: ["id", "content", "created_at"],
  workouts: ["id", "title", "workout_date", "notes", "exercises", "created_at"],
};

export type UndoData = { id?: string; previous?: Record<string, unknown>; row?: Record<string, unknown> };

function pick(obj: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));
}

/** What reverting an applied action means, from the undo data captured when applying. */
export function planUndo(kind: string, undo: unknown): ApplyPlan | null {
  const match = ENTITY_KIND.exec(kind);
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
    case "reminder":
      return "/#recordatorios";
    case "memory":
      return "/jax";
    case "workout":
      return typeof row.id === "string" ? `/fitness/entrenos/${row.id}` : "/fitness";
    case "routine":
      return typeof row.id === "string" ? `/fitness/rutinas/${row.id}` : "/fitness";
    case "weight":
      return "/fitness";
    case "muscle":
      return "/fitness#musculos";
  }
}

/** A stored mail.send payload, re-validated right before sending. */
export function planMail(kind: string, payload: unknown): MailDraft | null {
  if (kind !== "mail.send" || !payload || typeof payload !== "object") return null;
  const m = (payload as Proposal["payload"]).mail;
  if (!m || typeof m !== "object") return null;
  const subject = typeof m.subject === "string" ? m.subject.replace(/[\r\n]+/g, " ").trim() : "";
  const body = typeof m.body === "string" ? m.body.trim() : "";
  if (!subject || subject.length > MAIL_SUBJECT_MAX || !body || body.length > MAIL_BODY_MAX) return null;
  if (m.replyTo !== undefined) {
    return typeof m.replyTo === "string" && /^[0-9a-f]{8,32}$/i.test(m.replyTo) ? { to: [], subject, body, replyTo: m.replyTo } : null;
  }
  const to = Array.isArray(m.to) ? parseAddresses(m.to.join(",")) : null;
  return to ? { to, subject, body } : null;
}
