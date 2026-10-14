"use client";

import { Plus } from "lucide-react";
import { useActionState } from "react";
import { createTask } from "@/app/(app)/tareas/actions";
import { FormError } from "@/components/ui/form";
import { PRIORITIES, PRIORITY_LABEL, type Task } from "@/lib/tasks/types";
import { TITLE_MAX, parseTaskInput, type TaskFormState } from "@/lib/tasks/validation";

const control =
  "h-12 rounded-atlas bg-transparent px-4 text-base text-ink placeholder:text-muted focus-visible:outline-offset-0";

/** One-line composer: title, priority, due date. Details are edited later in the dialog. */
export function NewTaskForm({ onOptimisticAdd }: { onOptimisticAdd: (task: Task) => void }) {
  const [state, action, pending] = useActionState(
    async (prev: TaskFormState, formData: FormData) => {
      // Show the task immediately when the input is valid; the server is still the authority.
      const parsed = parseTaskInput(formData);
      if (parsed.ok) {
        onOptimisticAdd({
          id: `tmp-${crypto.randomUUID()}`,
          title: parsed.value.title,
          notes: parsed.value.notes,
          priority: parsed.value.priority,
          status: "pendiente",
          dueDate: parsed.value.dueDate,
          completedAt: null,
          createdAt: new Date().toISOString(),
        });
      }
      return createTask(prev, formData);
    },
    {},
  );

  return (
    <section aria-labelledby="new-task-title" className="flex flex-col gap-2">
      <h2 id="new-task-title" className="sr-only">
        Nueva tarea
      </h2>
      {/* React resets the form after the action; on error the typed title is restored. */}
      <form
        action={action}
        className="flex flex-col gap-1 rounded-atlas border border-line p-1 focus-within:border-accent md:flex-row md:items-center"
      >
        <label htmlFor="new-title" className="sr-only">
          Título
        </label>
        <input
          id="new-title"
          name="title"
          required
          maxLength={TITLE_MAX}
          defaultValue={state.title}
          placeholder="Añade una tarea…"
          autoComplete="off"
          className={`${control} w-full min-w-0 md:flex-1`}
        />
        <div className="flex items-center gap-1 border-t border-line pt-1 md:border-t-0 md:border-l md:pt-0 md:pl-1">
          <label htmlFor="new-priority" className="sr-only">
            Prioridad
          </label>
          <select id="new-priority" name="priority" defaultValue="media" className={`${control} w-32 text-sm`}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
          <label htmlFor="new-due" className="sr-only">
            Fecha límite
          </label>
          <input id="new-due" name="dueDate" type="date" className={`${control} min-w-0 flex-1 text-sm md:w-40`} />
          <button
            type="submit"
            disabled={pending}
            aria-label="Añadir tarea"
            className="pressable flex size-12 shrink-0 items-center justify-center rounded-atlas bg-accent text-white hover:bg-raised"
          >
            <Plus aria-hidden className="size-6" />
          </button>
        </div>
      </form>
      <FormError message={state.error} />
    </section>
  );
}
