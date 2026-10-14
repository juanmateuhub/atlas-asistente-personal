import { Field, inputClass } from "@/components/ui/form";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, type Task } from "@/lib/tasks/types";
import { NOTES_MAX, TITLE_MAX } from "@/lib/tasks/validation";

/** Shared inputs for creating and editing a task. `idPrefix` keeps label ids unique. */
export function TaskFields({
  idPrefix,
  task,
  withStatus = false,
  withNotes = false,
}: {
  idPrefix: string;
  task?: Partial<Task>;
  withStatus?: boolean;
  withNotes?: boolean;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <>
      <Field label="Título" htmlFor={id("title")}>
        <input
          id={id("title")}
          name="title"
          required
          maxLength={TITLE_MAX}
          defaultValue={task?.title}
          placeholder="Ej. Entregar práctica de Redes"
          className={inputClass}
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Prioridad" htmlFor={id("priority")}>
          <select
            id={id("priority")}
            name="priority"
            defaultValue={task?.priority ?? "media"}
            className={inputClass}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha límite" htmlFor={id("dueDate")}>
          <input
            id={id("dueDate")}
            name="dueDate"
            type="date"
            defaultValue={task?.dueDate ?? ""}
            className={inputClass}
          />
        </Field>
      </div>
      {withStatus && (
        <Field label="Estado" htmlFor={id("status")}>
          <select
            id={id("status")}
            name="status"
            defaultValue={task?.status ?? "pendiente"}
            className={inputClass}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
      )}
      {withNotes && (
        <Field label="Notas" htmlFor={id("notes")}>
          <textarea
            id={id("notes")}
            name="notes"
            rows={4}
            maxLength={NOTES_MAX}
            defaultValue={task?.notes ?? ""}
            className={inputClass}
          />
        </Field>
      )}
    </>
  );
}
