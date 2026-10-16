"use client";

import { useState, useTransition } from "react";
import { toggleTaskDone } from "@/app/(app)/tareas/actions";
import { TaskCheck } from "@/components/tasks/task-check";
import { useToast } from "@/components/ui/toast";
import { relativeDue } from "@/lib/tasks/dates";
import type { Task } from "@/lib/tasks/types";
import { playChime } from "@/lib/ui/sound";

type Phase = "check" | "leave" | "enter";
const CHECK_MS = 520;
const LEAVE_MS = 860;

/**
 * The next tasks on Inicio (today, overdue, then coming). Completing one pops the check, slides the row
 * away and offers "Deshacer", like Tareas.
 */
export function TodayTasks({ tasks, today, empty }: { tasks: Task[]; today: string; empty: React.ReactNode }) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [phases, setPhases] = useState<Map<string, Phase>>(() => new Map());
  // Completed here: hidden until the server stops sending them.
  const [gone, setGone] = useState<Set<string>>(() => new Set());
  // Brought back with "Deshacer" before the refreshed list includes them again.
  const [restored, setRestored] = useState<Task[]>([]);

  const setPhase = (id: string, phase: Phase | null) =>
    setPhases((m) => {
      const next = new Map(m);
      if (phase) next.set(id, phase);
      else next.delete(id);
      return next;
    });

  const send = (task: Task, done: boolean) => {
    const fd = new FormData();
    fd.set("id", task.id);
    fd.set("done", String(done));
    startTransition(() => toggleTaskDone(fd));
  };

  function complete(task: Task) {
    if (phases.has(task.id)) return;
    playChime("done");
    setPhase(task.id, "check");
    send(task, true);
    setTimeout(() => setPhase(task.id, "leave"), CHECK_MS);
    setTimeout(() => {
      setGone((s) => new Set(s).add(task.id));
      setRestored((r) => r.filter((t) => t.id !== task.id));
      setPhase(task.id, null);
      toast(`«${task.title}» completada`, () => undo(task));
    }, LEAVE_MS);
  }

  function undo(task: Task) {
    send(task, false);
    setRestored((r) => [...r.filter((t) => t.id !== task.id), task]);
    setGone((s) => {
      const next = new Set(s);
      next.delete(task.id);
      return next;
    });
    setPhase(task.id, "enter");
    requestAnimationFrame(() => requestAnimationFrame(() => setPhase(task.id, null)));
  }

  const ids = new Set(tasks.map((t) => t.id));
  const rows = [...tasks, ...restored.filter((t) => !ids.has(t.id))].filter((t) => !gone.has(t.id));

  if (rows.length === 0) return empty;

  return (
    <ul className="mx-[-10px] my-[-8px] flex flex-col">
      {rows.map((task) => {
        const phase = phases.get(task.id) ?? null;
        const checked = phase === "check" || phase === "leave";
        const hidden = phase === "leave" || phase === "enter";
        return (
          <li
            key={task.id}
            style={{
              maxHeight: hidden ? 0 : 96,
              opacity: hidden ? 0 : 1,
              overflow: hidden ? "hidden" : "visible",
              transform: phase === "leave" ? "translateX(28px) scale(.98)" : phase === "enter" ? "translateY(-10px)" : "none",
              transition: "max-height .34s cubic-bezier(.4,0,.2,1), opacity .3s, transform .34s",
            }}
          >
            <div className="flex items-center gap-[14px] p-[10px]">
              <TaskCheck
                checked={checked}
                pop={phase === "check"}
                label={`Completar "${task.title}"`}
                onClick={() => complete(task)}
              />
              <div className="flex min-w-0 flex-col gap-[2px]">
                <span
                  className="truncate text-[15.5px] font-semibold transition-colors duration-300"
                  style={{
                    color: checked ? "var(--color-neutral-500)" : "var(--color-text)",
                    textDecorationLine: checked ? "line-through" : "none",
                    textDecorationColor: "var(--color-neutral-600)",
                  }}
                >
                  {task.title}
                </span>
                <span className="text-[12.5px] whitespace-nowrap text-neutral-500">
                  {relativeDue(task.dueDate, today)}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
