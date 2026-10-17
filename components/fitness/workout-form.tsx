"use client";

import { BookmarkSimple, Trash } from "@phosphor-icons/react";
import { useActionState, useState } from "react";
import { deleteRoutine, deleteWorkout, routineFromWorkout, saveRoutine, saveWorkout } from "@/app/(app)/fitness/actions";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Field, FormError, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { summarize, volume, formatKg } from "@/lib/fitness/stats";
import type { MuscleMap } from "@/lib/fitness/muscles";
import type { Routine, Workout, WorkoutSet } from "@/lib/fitness/types";
import type { FitnessFormState } from "@/lib/fitness/validation";
import { ExerciseEditor } from "./exercise-editor";

type Props =
  | {
      kind: "workout";
      workout: Workout;
      suggestions: string[];
      previous: Record<string, { date: string; sets: WorkoutSet[] }>;
      overrides: Record<string, MuscleMap>;
    }
  | { kind: "routine"; routine: Routine; suggestions: string[] };

/** Editor page body for a workout or a routine: name, details, exercises; saved as one form. */
export function WorkoutForm(props: Props) {
  const isWorkout = props.kind === "workout";
  const item = isWorkout ? props.workout : props.routine;
  const toast = useToast();
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: FitnessFormState, fd: FormData) => {
    const result = await (isWorkout ? saveWorkout : saveRoutine)(prev, fd);
    if (result.ok) {
      setDirty(false);
      toast(isWorkout ? "Entreno guardado" : "Rutina guardada");
    }
    return result;
  }, {});
  const markDirty = () => setDirty(true);
  const prefix = `${props.kind}-${item.id}`;

  return (
    <form action={formAction} onChange={markDirty} className="flex flex-col gap-8">
      <input type="hidden" name="id" value={item.id} />

      <div className="grid grid-cols-1 gap-4 rounded-[22px] bg-surface p-[22px] sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Field label="Nombre" htmlFor={`${prefix}-title`}>
          <input
            id={`${prefix}-title`}
            name={isWorkout ? "title" : "name"}
            defaultValue={isWorkout ? props.workout.title : props.routine.name}
            required
            maxLength={80}
            className={inputClass}
          />
        </Field>
        {isWorkout && (
          <Field label="Fecha" htmlFor={`${prefix}-date`}>
            <input id={`${prefix}-date`} name="date" type="date" defaultValue={props.workout.date} required className={inputClass} />
          </Field>
        )}
        <div className="sm:col-span-2">
          <Field label="Notas" htmlFor={`${prefix}-notes`}>
            <textarea
              id={`${prefix}-notes`}
              name="notes"
              defaultValue={item.notes ?? ""}
              rows={2}
              maxLength={2000}
              placeholder={isWorkout ? "Cómo te has sentido, molestias, qué subir la próxima vez…" : "Para qué es, cuántos días a la semana…"}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <section aria-labelledby={`${prefix}-exercises`} className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id={`${prefix}-exercises`} className="m-0 text-[26px] tracking-[-0.035em]">
            Ejercicios
          </h2>
          <p className="m-0 text-[13px] text-neutral-500 tabular-nums">
            {summarize(item.exercises)}
            {isWorkout && volume(props.workout.exercises) > 0 && ` · ${formatKg(volume(props.workout.exercises))} movidos`}
          </p>
        </div>
        {/* Remounts with the saved (normalised) exercises after each save. */}
        <ExerciseEditor
          key={JSON.stringify(item.exercises)}
          initial={item.exercises}
          suggestions={props.suggestions}
          previous={isWorkout ? props.previous : undefined}
          overrides={isWorkout ? props.overrides : undefined}
          onChange={markDirty}
        />
      </section>

      {/* Stays at hand at the bottom of the screen while editing a long workout. */}
      <div className="sticky bottom-[calc(16px+env(safe-area-inset-bottom))] z-[5] flex flex-wrap items-center justify-end gap-3 max-md:bottom-[calc(80px+env(safe-area-inset-bottom))]">
        <FormError message={state.error} />
        {dirty && !pending && <span className="text-[13px] text-neutral-500">Cambios sin guardar</span>}
        <button
          type="submit"
          disabled={pending}
          className={`${primaryButtonClass} h-[48px] px-6 text-[15px]`}
          style={dirty ? { boxShadow: "var(--shadow-md)" } : undefined}
        >
          {pending ? "Guardando…" : isWorkout ? "Guardar entreno" : "Guardar rutina"}
        </button>
      </div>
    </form>
  );
}

/** Secondary actions in the header: save as routine (workouts) and delete. */
export function WorkoutActions(
  props: { kind: "workout"; workout: Workout; routineNames: string[] } | { kind: "routine"; routine: Routine },
) {
  const isWorkout = props.kind === "workout";
  const item = isWorkout ? props.workout : props.routine;
  const name = isWorkout ? props.workout.title : props.routine.name;
  const toast = useToast();

  return (
    <div className="flex flex-wrap gap-2">
      {/* Not for a workout started from a routine (same name): it would only duplicate it. */}
      {isWorkout &&
        props.workout.exercises.length > 0 &&
        !props.routineNames.some((n) => n.toLocaleLowerCase("es") === name.trim().toLocaleLowerCase("es")) && (
        <ActionDialog
          title="Guardar como rutina"
          action={async (prev, fd) => {
            const result = await routineFromWorkout(prev, fd);
            if (result.ok) toast("Rutina creada");
            return result;
          }}
          submitLabel="Crear rutina"
          pendingLabel="Creando…"
          trigger={(open) => (
            <button type="button" onClick={open} className={secondaryButtonClass}>
              <BookmarkSimple size={16} />
              Guardar como rutina
            </button>
          )}
        >
          <input type="hidden" name="exercises" value={JSON.stringify(props.workout.exercises)} />
          <Field label="Nombre de la rutina" htmlFor={`routine-from-${item.id}`} hint="Copia los ejercicios y series guardados de este entreno.">
            <input id={`routine-from-${item.id}`} name="name" defaultValue={name} required maxLength={80} className={inputClass} />
          </Field>
        </ActionDialog>
      )}
      <ActionDialog
        title={isWorkout ? "¿Borrar este entreno?" : "¿Borrar esta rutina?"}
        action={isWorkout ? deleteWorkout : deleteRoutine}
        submitLabel="Borrar"
        pendingLabel="Borrando…"
        danger
        trigger={(open) => (
          <button type="button" onClick={open} className={secondaryButtonClass}>
            <Trash size={16} />
            Borrar
          </button>
        )}
      >
        <input type="hidden" name="id" value={item.id} />
        <p className="text-[14px] text-neutral-300">Vas a borrar «{name}». No se puede deshacer.</p>
      </ActionDialog>
    </div>
  );
}
