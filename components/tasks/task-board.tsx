"use client";

import { ArrowUp, Sparkle } from "@phosphor-icons/react";
import { useMemo, useRef, useState, useTransition } from "react";
import { createTask, toggleTaskDone } from "@/app/(app)/tareas/actions";
import { FormError } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { relativeDue } from "@/lib/tasks/dates";
import {
  FILTERS,
  PRIORITIES,
  PRIORITY_LABEL,
  compareTasks,
  matchesFilter,
  type Priority,
  type Task,
  type TaskFilter,
} from "@/lib/tasks/types";
import { TITLE_MAX } from "@/lib/tasks/validation";
import { playChime } from "@/lib/ui/sound";
import { PRIORITY_COLOR, TaskRow, type RowPhase } from "./task-row";

/** Local, short-lived state for a row while it animates or waits for the server. */
type Override = { done: boolean; phase: RowPhase };

const FILTER_LABEL: Record<TaskFilter, string> = { pendientes: "Pendientes", hechas: "Hechas", todas: "Todas" };
/** Timeline from the redesign: check pop → (leave) → settle. */
const CHECK_MS = 520;
const LEAVE_MS = 860;

// Flat white composer; focus draws an ink ring (no glow).
const COMPOSER_SHADOW = {
  idle: "none",
  focus: "0 0 0 2px var(--color-text)",
};

/**
 * Tareas, Nocturne edition. Data still comes from the server (all tasks) and
 * changes go through the same server actions; filtering happens here so the
 * pill slides and finished rows can animate away before they disappear.
 */
export function TaskBoard({ tasks, today, initialFilter }: { tasks: Task[]; today: string; initialFilter: TaskFilter }) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [filter, setFilter] = useState<TaskFilter>(initialFilter);
  const [overrides, setOverrides] = useState<Map<string, Override>>(() => new Map());
  const [temps, setTemps] = useState<Task[]>([]);
  // Per-row bookkeeping: an override is dropped once its animation ended AND the server confirmed.
  const settle = useRef(new Map<string, { anim: boolean; server: boolean }>());

  const [draft, setDraft] = useState("");
  const [draftPrio, setDraftPrio] = useState<Priority>("media");
  // Today by default: most tasks are added for today; the date can be cleared or changed.
  const [draftDate, setDraftDate] = useState(today);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const input = useRef<HTMLInputElement>(null);

  const setOverride = (id: string, value: Override | null) =>
    setOverrides((m) => {
      const next = new Map(m);
      if (value) next.set(id, value);
      else next.delete(id);
      return next;
    });

  const markSettled = (id: string, part: "anim" | "server") => {
    const s = settle.current.get(id) ?? { anim: false, server: false };
    s[part] = true;
    if (s.anim && s.server) {
      settle.current.delete(id);
      setOverride(id, null);
    } else settle.current.set(id, s);
  };

  const rows = useMemo(() => {
    const all = [...tasks, ...temps].sort(compareTasks);
    return all.map((task) => {
      const o = overrides.get(task.id);
      return { task, done: o ? o.done : task.status === "hecha", phase: o?.phase ?? null };
    });
  }, [tasks, temps, overrides]);

  const counts = {
    pendientes: rows.filter((r) => !r.done).length,
    hechas: rows.filter((r) => r.done).length,
    todas: rows.length,
  };
  const visible = rows.filter((r) => matchesFilter(r.done, r.phase !== null, filter));

  function setStatus(task: Task, done: boolean) {
    settle.current.set(task.id, { anim: false, server: false });
    const fd = new FormData();
    fd.set("id", task.id);
    fd.set("done", String(done));
    startTransition(async () => {
      await toggleTaskDone(fd);
      markSettled(task.id, "server");
    });
  }

  function toggle(row: (typeof rows)[number]) {
    if (row.phase || row.task.id.startsWith("tmp-")) return;
    const { task, done: wasDone } = row;
    const leaves = filter !== "todas";
    if (!wasDone) playChime("done");

    setOverride(task.id, { done: wasDone, phase: "check" });
    setStatus(task, !wasDone);
    if (leaves) setTimeout(() => setOverride(task.id, { done: wasDone, phase: "leave" }), CHECK_MS);
    setTimeout(
      () => {
        setOverride(task.id, { done: !wasDone, phase: null });
        markSettled(task.id, "anim");
        if (!wasDone) toast(`«${task.title}» completada`, () => undo(task));
      },
      leaves ? LEAVE_MS : CHECK_MS,
    );
  }

  /** Toast "Deshacer": the task comes back as pending, dropping in. */
  function undo(task: Task) {
    setOverride(task.id, { done: false, phase: "enter" });
    setStatus(task, false);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setOverride(task.id, { done: false, phase: null });
        markSettled(task.id, "anim");
      }),
    );
  }

  function addTask() {
    const title = draft.trim();
    if (!title) return;
    setError(undefined);
    const temp: Task = {
      id: `tmp-${crypto.randomUUID()}`,
      title,
      notes: null,
      priority: draftPrio,
      status: "pendiente",
      dueDate: draftDate || null,
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
    playChime("add");
    setTemps((t) => [...t, temp]);
    setOverride(temp.id, { done: false, phase: "enter" });
    requestAnimationFrame(() => requestAnimationFrame(() => setOverride(temp.id, null)));
    if (filter === "hechas") setFilter("pendientes");
    setDraft("");
    setDraftDate(today);

    const fd = new FormData();
    fd.set("title", title);
    fd.set("priority", draftPrio);
    if (temp.dueDate) fd.set("dueDate", temp.dueDate);
    startTransition(async () => {
      const result = await createTask({}, fd);
      // The refreshed list (with the real row) arrives with this transition.
      startTransition(() => setTemps((t) => t.filter((x) => x.id !== temp.id)));
      if (result.error) {
        setError(result.error);
        setDraft(title);
      }
    });
  }

  const canAdd = draft.trim().length > 0;
  const filterIndex = FILTERS.indexOf(filter);

  return (
    <>
      {/* Composer */}
      <div>
        <div
          className="flex items-center gap-[6px] rounded-full py-[6px] pr-[6px] pl-4 max-sm:flex-wrap max-sm:rounded-[22px] max-sm:pl-3"
          style={{
            background: "var(--color-surface)",
            boxShadow: focused ? COMPOSER_SHADOW.focus : COMPOSER_SHADOW.idle,
            transition: "box-shadow .2s",
          }}
        >
          <label htmlFor="new-task" className="sr-only">
            Nueva tarea
          </label>
          <input
            id="new-task"
            ref={input}
            value={draft}
            maxLength={TITLE_MAX}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTask();
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Añade una tarea…"
            autoComplete="off"
            className="h-11 min-w-[120px] flex-1 border-0 bg-transparent px-[6px] text-[15.5px] text-text outline-none focus-visible:outline-none"
          />
          <button
            type="button"
            onClick={() => setDraftPrio(PRIORITIES[(PRIORITIES.indexOf(draftPrio) + 2) % 3])}
            title="Cambiar prioridad"
            aria-label={`Prioridad ${PRIORITY_LABEL[draftPrio].toLowerCase()}. Pulsa para cambiarla`}
            className="flex h-[34px] cursor-pointer items-center gap-2 rounded-full border-0 px-[14px] text-[13px] font-medium whitespace-nowrap text-neutral-300 transition-[background,scale] duration-200 hover:bg-neutral-800 active:scale-[0.94]"
            style={{ background: "var(--color-step)" }}
          >
            <span
              className="size-[7px] rounded-full"
              style={{ background: PRIORITY_COLOR[draftPrio] }}
            />
            {PRIORITY_LABEL[draftPrio]}
          </button>
          <label htmlFor="new-task-date" className="sr-only">
            Fecha límite
          </label>
          <input
            id="new-task-date"
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.currentTarget.value)}
            className="h-[34px] cursor-pointer rounded-full border-0 px-3 text-[13px] text-neutral-300"
            style={{ background: "var(--color-step)" }}
          />
          <button
            type="button"
            onClick={addTask}
            disabled={!canAdd}
            title="Añadir"
            aria-label="Añadir tarea"
            className="grid size-11 flex-none cursor-pointer place-items-center rounded-full active:scale-[0.88] disabled:cursor-not-allowed disabled:opacity-100"
            style={{
              background: canAdd ? "var(--color-accent)" : "var(--color-step)",
              color: canAdd ? "var(--color-on-accent)" : "var(--color-neutral-600)",
              transition: "background .2s, color .2s, scale .2s cubic-bezier(.34,1.8,.5,1)",
            }}
          >
            <ArrowUp size={18} />
          </button>
        </div>
        {error && (
          <div className="pt-2 pl-5">
            <FormError message={error} />
          </div>
        )}
      </div>

      {/* Filters: segmented control with a sliding pill */}
      <div className="mt-[36px] mb-[18px] flex">
        <div
          role="tablist"
          aria-label="Filtrar tareas"
          // --pill: 120px like the redesign; narrower on phones so the three tabs fit 360px.
          className="relative flex rounded-full p-1 [--pill:104px] sm:[--pill:120px]"
          style={{ background: "var(--color-step)" }}
        >
          <div
            aria-hidden
            className="absolute top-1 left-1 h-8 rounded-full bg-text"
            style={{
              width: "var(--pill)",
              transform: `translateX(calc(${filterIndex} * var(--pill)))`,
              transition: "transform .5s cubic-bezier(.34,1.45,.5,1)",
            }}
          />
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={f === filter}
              onClick={() => setFilter(f)}
              className="relative flex h-8 cursor-pointer items-center justify-center gap-[7px] border-0 bg-transparent text-[13.5px] font-medium transition-colors duration-[250ms]"
              style={{ width: "var(--pill)", color: f === filter ? "var(--color-bg)" : "var(--color-neutral-400)" }}
            >
              {FILTER_LABEL[f]}
              <span className="text-[11.5px] tabular-nums opacity-60">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col" role="tabpanel">
        {visible.map((row) => (
          <TaskRow
            key={row.task.id}
            task={row.task}
            done={row.done}
            phase={row.phase}
            dueLabel={relativeDue(row.task.dueDate, today)}
            pending={row.task.id.startsWith("tmp-")}
            onToggle={() => toggle(row)}
          />
        ))}
        {visible.length === 0 && (
          <div className="flex animate-rise flex-col gap-[10px] py-12">
            <Sparkle size={26} weight="fill" color="var(--color-accent)" />
            <span className="text-[15px] text-neutral-400">
              {filter === "hechas" ? "Aún no has completado ninguna tarea." : "Todo hecho. Disfruta del día."}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
