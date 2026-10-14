"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Pencil, Trash2 } from "lucide-react";
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
import type { DueInfo } from "@/lib/tasks/dates";
import { PRIORITY_LABEL, STATUS_LABEL, type Task } from "@/lib/tasks/types";
import type { TaskFormState } from "@/lib/tasks/validation";
import { TaskFields } from "./task-fields";

export function TaskItem({
  task,
  due,
  pending,
  onToggle,
}: {
  task: Task;
  due: DueInfo | null;
  /** Optimistic row not yet saved: not editable. */
  pending: boolean;
  onToggle: () => void;
}) {
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
    <div className="group flex items-center gap-3 rounded-atlas px-3 py-3 hover:bg-line/15">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        disabled={pending}
        onClick={onToggle}
        aria-label={done ? `Marcar "${task.title}" como pendiente` : `Marcar "${task.title}" como hecha`}
        className="pressable relative flex size-6 shrink-0 items-center justify-center rounded-full border border-line hover:border-accent"
      >
        <AnimatePresence initial={false}>
          {done && (
            <motion.span
              key="fill"
              aria-hidden
              className="absolute -inset-px flex items-center justify-center rounded-full bg-accent text-white"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.12 } }}
              transition={{ type: "spring", stiffness: 600, damping: 26 }}
            >
              <Check className="size-4" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p
          className={`truncate text-base transition-opacity duration-150 ${
            done ? "text-muted line-through opacity-70" : "text-ink"
          }`}
        >
          {task.title}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={`size-2 rounded-full ${
                task.priority === "alta" ? "bg-accent" : task.priority === "media" ? "bg-sky" : "bg-line"
              }`}
            />
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

      <div className="flex opacity-100 transition-opacity duration-150 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        <button
          type="button"
          onClick={edit.open}
          disabled={pending}
          aria-label={`Editar "${task.title}"`}
          className={iconButtonClass}
        >
          <Pencil aria-hidden className="size-5" />
        </button>
        <button
          type="button"
          onClick={remove.open}
          disabled={pending}
          aria-label={`Borrar "${task.title}"`}
          className={iconButtonClass}
        >
          <Trash2 aria-hidden className="size-5" />
        </button>
      </div>

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
              {editPending ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog dialogRef={remove.ref} title="¿Borrar esta tarea?" alert onClose={remove.close}>
        <form action={deleteAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={task.id} />
          <p className="text-base">Vas a borrar «{task.title}». No se puede deshacer.</p>
          <FormError message={deleteState.error} />
          <div className="flex justify-end gap-3">
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
