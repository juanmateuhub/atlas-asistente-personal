"use client";

import { useActionState } from "react";
import { createTask } from "@/app/(app)/tareas/actions";
import { FormError, primaryButtonClass } from "@/components/ui/form";
import { TaskFields } from "./task-fields";

export function NewTaskForm() {
  const [state, action, pending] = useActionState(createTask, {});

  return (
    <section aria-labelledby="new-task-title" className="rounded-atlas border border-line p-6">
      <h2 id="new-task-title" className="sr-only">
        Nueva tarea
      </h2>
      {/* React resets the form after a successful action; on error the typed title is restored. */}
      <form action={action} className="flex flex-col gap-4">
        <TaskFields idPrefix="new" task={state.title ? { title: state.title } : undefined} />
        <FormError message={state.error} />
        <div>
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? "Añadiendo…" : "Añadir tarea"}
          </button>
        </div>
      </form>
    </section>
  );
}
