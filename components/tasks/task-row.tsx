"use client";

import { CalendarBlank, PencilSimple, Trash } from "@phosphor-icons/react";
import { useActionState } from "react";
import { deleteTask, updateTask } from "@/app/(app)/tareas/actions";
import { Dialog, useDialog } from "@/components/ui/dialog";
import {
  FormError,
  dangerButtonClass,
  iconButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/form";
import { PRIORITY_LABEL, type Priority, type Task } from "@/lib/tasks/types";
import type { TaskFormState } from "@/lib/tasks/validation";
import { TaskCheck } from "./task-check";
import { TaskFields } from "./task-fields";

export type RowPhase = "check" | "leave" | "enter" | null;

export const PRIORITY_COLOR: Record<Priority, string> = {
  baja: "var(--color-neutral-500)",
  media: "var(--color-accent-600)",
  alta: "var(--color-accent-300)",
};

/**
 * One task, styled and animated like the redesign:
 * check → (leave: collapse + slide right) / enter: drop in from above.
 * Edit/delete live behind hover-revealed icons.
 */
export function TaskRow({
  task,
  done,
  phase,
  dueLabel,
  pending,
  onToggle,
}: {
  task: Task;
  done: boolean;
  phase: RowPhase;
  dueLabel: string;
  /** Optimistic row not saved yet. */
  pending: boolean;
  onToggle: () => void;
}) {
  const checked = phase === "check" || phase === "leave" ? !done : done;
  const pop = phase === "check" && !done;
  const hidden = phase === "leave" || phase === "enter";

  const edit = useDialog();
  const remove = useDialog();
  const [editState, editAction, editPending] = useActionState(async (prev: TaskFormState, fd: FormData) => {
    const result = await updateTask(prev, fd);
    if (result.ok) edit.close();
    return result;
  }, {});
  const [deleteState, deleteAction, deletePending] = useActionState(async (prev: TaskFormState, fd: FormData) => {
    const result = await deleteTask(prev, fd);
    if (result.ok) remove.close();
    return result;
  }, {});

  return (
    <div
      style={{
        maxHeight: hidden ? 0 : 96,
        opacity: hidden ? 0 : 1,
        overflow: hidden ? "hidden" : "visible",
        transform: phase === "leave" ? "translateX(28px) scale(.98)" : phase === "enter" ? "translateY(-10px)" : "none",
        transition:
          "max-height .34s cubic-bezier(.4,0,.2,1), opacity .3s, transform .34s cubic-bezier(.4,0,.2,1)",
      }}
    >
      <div className="group mx-[-14px] flex items-center gap-4 rounded-[14px] p-[14px] transition-[background] duration-200 hover:bg-[color-mix(in_srgb,var(--color-text)_4%,transparent)]">
        <TaskCheck
          checked={checked}
          pop={pop}
          disabled={pending}
          label={checked ? `Marcar "${task.title}" como pendiente` : `Completar "${task.title}"`}
          onClick={onToggle}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            className="truncate text-[15.5px] font-medium transition-colors duration-300"
            style={{
              color: checked ? "var(--color-neutral-500)" : "var(--color-text)",
              textDecorationLine: checked ? "line-through" : "none",
              textDecorationColor: "var(--color-neutral-600)",
            }}
          >
            {task.title}
          </span>
          <span className="flex items-center gap-3 text-[12.5px] whitespace-nowrap text-neutral-500">
            <span className="flex items-center gap-[6px]">
              <span className="size-[6px] rounded-full" style={{ background: PRIORITY_COLOR[task.priority] }} />
              Prioridad {PRIORITY_LABEL[task.priority].toLowerCase()}
            </span>
            <span className="flex items-center gap-[5px]">
              <CalendarBlank size={13} />
              {dueLabel}
            </span>
            {task.status === "en_curso" && !checked && <span className="text-accent-300">En curso</span>}
          </span>
        </div>

        <div className="flex opacity-100 transition-opacity duration-200 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          <button
            type="button"
            onClick={edit.open}
            disabled={pending}
            aria-label={`Editar "${task.title}"`}
            className={iconButtonClass}
          >
            <PencilSimple size={16} />
          </button>
          <button
            type="button"
            onClick={remove.open}
            disabled={pending}
            aria-label={`Borrar "${task.title}"`}
            className={iconButtonClass}
          >
            <Trash size={16} />
          </button>
        </div>
      </div>

      <Dialog dialogRef={edit.ref} title="Editar tarea" onClose={edit.close}>
        <form action={editAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={task.id} />
          <TaskFields idPrefix={`edit-${task.id}`} task={task} withStatus withNotes />
          <FormError message={editState.error} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={edit.close} className={secondaryButtonClass}>
              Cancelar
            </button>
            <button type="submit" disabled={editPending} className={primaryButtonClass}>
              {editPending ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog dialogRef={remove.ref} title="¿Borrar esta tarea?" alert onClose={remove.close}>
        <form action={deleteAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={task.id} />
          <p className="text-[14px] text-neutral-300">Vas a borrar «{task.title}». No se puede deshacer.</p>
          <FormError message={deleteState.error} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={remove.close} className={secondaryButtonClass}>
              Cancelar
            </button>
            <button type="submit" disabled={deletePending} className={dangerButtonClass}>
              {deletePending ? "Borrando…" : "Borrar tarea"}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
