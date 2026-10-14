"use client";

import { Check, Pencil, Trash2 } from "lucide-react";
import { useActionState } from "react";
import { deleteTask, toggleTaskDone, updateTask } from "@/app/(app)/tareas/actions";
import { Dialog, useDialog } from "@/components/ui/dialog";
import {
  FormError,
  dangerButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/form";
import type { DueInfo } from "@/lib/tasks/dates";
import { PRIORITY_LABEL, STATUS_LABEL, type Task } from "@/lib/tasks/types";
import type { TaskFormState } from "@/lib/tasks/validation";
import { TaskFields } from "./task-fields";

const iconButton =
  "flex size-10 shrink-0 items-center justify-center rounded-atlas text-muted hover:bg-raised hover:text-white";

export function TaskItem({ task, due }: { task: Task; due: DueInfo | null }) {
  const done = task.status === "hecha";
  const edit = useDialog();
  const remove = useDialog();

  // Close the dialog once the server confirms the change.
  const [editState, editAction, editPending] = useActionState(
    async (prev: TaskFormState, fd: FormData) => {
      const result = await updateTask(prev, fd);
      if (result.ok) edit.close();
      return result;
    },
    {},
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    async (prev: TaskFormState, fd: FormData) => {
      const result = await deleteTask(prev, fd);
      if (result.ok) remove.close();
      return result;
    },
    {},
  );

  return (
    <li className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
      <form action={toggleTaskDone}>
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="done" value={String(!done)} />
        <button
          type="submit"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Marcar "${task.title}" como pendiente` : `Marcar "${task.title}" como hecha`}
          className={`flex size-6 items-center justify-center rounded-full border ${
            done ? "border-accent bg-accent text-white" : "border-line hover:border-accent"
          }`}
        >
          {done && <Check aria-hidden className="size-4" />}
        </button>
      </form>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={`truncate text-base ${done ? "text-muted line-through" : "text-ink"}`}>
          {task.title}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className={task.priority === "alta" && !done ? "font-medium text-accent" : undefined}>
            Prioridad {PRIORITY_LABEL[task.priority].toLowerCase()}
          </span>
          {task.status === "en_curso" && <span>{STATUS_LABEL.en_curso}</span>}
          {due && !done && (
            <span
              className={
                due.tone === "overdue"
                  ? "font-medium text-red-700"
                  : due.tone === "soon"
                    ? "font-medium text-accent"
                    : undefined
              }
            >
              {due.label}
            </span>
          )}
        </div>
      </div>

      <button type="button" onClick={edit.open} aria-label={`Editar "${task.title}"`} className={iconButton}>
        <Pencil aria-hidden className="size-5" />
      </button>
      <button type="button" onClick={remove.open} aria-label={`Borrar "${task.title}"`} className={iconButton}>
        <Trash2 aria-hidden className="size-5" />
      </button>

      <Dialog dialogRef={edit.ref} title="Editar tarea" onClose={edit.close}>
        <form action={editAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={task.id} />
          <TaskFields idPrefix={`edit-${task.id}`} task={task} withStatus withNotes />
          <FormError message={editState.error} />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={edit.close} className={secondaryButtonClass}>
              Cancelar
            </button>
            <button type="submit" disabled={editPending} className={primaryButtonClass}>
              {editPending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog dialogRef={remove.ref} title="¿Borrar esta tarea?" alert onClose={remove.close}>
        <form action={deleteAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={task.id} />
          <p className="text-base">
            Vas a borrar «{task.title}». No se puede deshacer.
          </p>
          <FormError message={deleteState.error} />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={remove.close} className={secondaryButtonClass}>
              Cancelar
            </button>
            <button type="submit" disabled={deletePending} className={dangerButtonClass}>
              {deletePending ? "Borrando…" : "Borrar"}
            </button>
          </div>
        </form>
      </Dialog>
    </li>
  );
}
