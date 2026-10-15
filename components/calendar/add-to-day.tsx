"use client";

import { Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { createEvent } from "@/app/(app)/calendario/actions";
import { createTask } from "@/app/(app)/tareas/actions";
import { createExam } from "@/app/(app)/universidad/actions";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Field, inputClass } from "@/components/ui/form";
import { TaskFields } from "@/components/tasks/task-fields";
import { ExamFields } from "@/components/university/fields";
import { formatDay } from "@/lib/calendar/grid";
import { EventFields } from "./event-fields";

type Kind = "event" | "task" | "exam";
const KINDS: { key: Kind; label: string; dot: string }[] = [
  { key: "event", label: "Evento", dot: "var(--color-accent-600)" },
  { key: "task", label: "Tarea", dot: "var(--color-neutral-500)" },
  { key: "exam", label: "Examen", dot: "var(--color-accent-300)" },
];

const SUBMIT: Record<Kind, string> = { event: "Añadir evento", task: "Añadir tarea", exam: "Añadir examen" };

/**
 * "+" on a calendar day: one dialog to add an event, a task (due that day) or
 * an exam (for a subject). Each kind uses its existing server action.
 */
export function AddToDay({ day, subjects }: { day: string; subjects: { id: string; name: string }[] }) {
  const [kind, setKind] = useState<Kind>("event");
  const index = KINDS.findIndex((k) => k.key === kind);

  return (
    <ActionDialog
      title={`Nuevo ${KINDS[index].label.toLowerCase()}`}
      action={async (prev, fd) => {
        if (kind === "task") return createTask(prev, fd);
        if (kind === "exam") return createExam(prev, fd);
        return createEvent(prev, fd);
      }}
      submitLabel={SUBMIT[kind]}
      pendingLabel="Añadiendo…"
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          title="Añadir al día"
          aria-label="Añadir evento, tarea o examen"
          className="grid size-[42px] cursor-pointer place-items-center rounded-full border border-accent text-accent-200 transition-[rotate,scale,background] duration-200 hover:rotate-90 hover:bg-[color-mix(in_srgb,var(--color-accent)_22%,transparent)] active:scale-[0.88]"
          style={{
            background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
            boxShadow: "0 0 20px color-mix(in srgb, var(--color-accent) 30%, transparent)",
            transitionTimingFunction: "cubic-bezier(.34,1.8,.5,1)",
          }}
        >
          <Plus size={18} />
        </button>
      )}
    >
      <p className="-mt-2 text-[13px] text-neutral-500">{formatDay(day)}</p>

      {/* Type picker: segmented control with a sliding indicator, as in the redesign. */}
      <div
        role="radiogroup"
        aria-label="Qué quieres añadir"
        className="relative flex rounded-[12px] p-1"
        style={{ background: "color-mix(in srgb, var(--color-text) 5%, transparent)" }}
      >
        <div
          aria-hidden
          className="absolute top-1 left-1 h-[34px] rounded-[9px] bg-bg"
          style={{
            width: "calc((100% - 8px) / 3)",
            boxShadow: "0 0 0 1px color-mix(in srgb, var(--color-accent) 40%, transparent)",
            transform: `translateX(${index * 100}%)`,
            transition: "transform .45s cubic-bezier(.34,1.45,.5,1)",
          }}
        />
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            role="radio"
            aria-checked={k.key === kind}
            onClick={() => setKind(k.key)}
            className="relative flex h-[34px] flex-1 cursor-pointer items-center justify-center gap-[7px] border-0 bg-transparent text-[13.5px] font-medium transition-colors duration-[250ms]"
            style={{ color: k.key === kind ? "var(--color-text)" : "var(--color-neutral-400)" }}
          >
            <span className="size-[7px] rounded-full" style={{ background: k.dot }} />
            {k.label}
          </button>
        ))}
      </div>

      {/* key: fresh fields (and defaults) when the type or the day changes. */}
      <div key={`${kind}-${day}`} className="flex animate-fade flex-col gap-4">
        {kind === "event" && <EventFields idPrefix="day-event" defaultDate={day} />}
        {kind === "task" && <TaskFields idPrefix="day-task" task={{ dueDate: day }} />}
        {kind === "exam" &&
          (subjects.length === 0 ? (
            <p className="text-[14px] text-neutral-300">
              Para añadir un examen necesitas una asignatura.{" "}
              <Link href="/universidad" className="font-medium text-accent-300 hover:text-accent-200">
                Crea una en Universidad
              </Link>
              .
            </p>
          ) : (
            <>
              <Field label="Asignatura" htmlFor="day-exam-subject">
                <select id="day-exam-subject" name="subjectId" required className={inputClass} defaultValue={subjects[0].id}>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <ExamFields idPrefix="day-exam" defaultDate={day} />
            </>
          ))}
      </div>
    </ActionDialog>
  );
}
