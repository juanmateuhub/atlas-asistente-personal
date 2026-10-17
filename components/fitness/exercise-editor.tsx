"use client";

import { Plus, Trash, X } from "@phosphor-icons/react";
import { useId, useState } from "react";
import { iconButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { formatSets, performanceFor } from "@/lib/fitness/stats";
import type { Exercise, WorkoutSet } from "@/lib/fitness/types";

type SetDraft = { key: number; reps: string; weight: string };
type ExerciseDraft = { key: number; name: string; sets: SetDraft[] };

let seq = 0;
const nextKey = () => ++seq;

const kgText = (w: number | null) => (w === null ? "" : String(w).replace(".", ","));

function toDraft(exercises: Exercise[]): ExerciseDraft[] {
  return exercises.map((e) => ({
    key: nextKey(),
    name: e.name,
    sets: e.sets.map((s) => ({ key: nextKey(), reps: String(s.reps), weight: kgText(s.weight) })),
  }));
}

/** What the server parses: blank set rows are dropped, the rest is validated there. */
function serialize(drafts: ExerciseDraft[]) {
  return JSON.stringify(
    drafts.map((e) => ({
      name: e.name,
      sets: e.sets.filter((s) => s.reps.trim() || s.weight.trim()).map((s) => ({ reps: s.reps, weight: s.weight })),
    })),
  );
}

const cellInput =
  "h-[40px] w-full min-w-0 rounded-[12px] bg-step px-3 text-center text-[15px] tabular-nums text-text transition-colors placeholder:text-neutral-600 hover:bg-neutral-800 focus-visible:bg-surface focus-visible:outline-2 focus-visible:outline-text";

/**
 * Exercises and their sets, edited in place. Writes the list as JSON into a
 * hidden `exercises` input, so it posts with the surrounding form.
 */
export function ExerciseEditor({
  initial,
  suggestions,
  previous,
  onChange,
}: {
  initial: Exercise[];
  /** Exercise names used before, offered while typing. */
  suggestions: string[];
  /** Last time each exercise was done (workouts only). */
  previous?: Record<string, { date: string; sets: WorkoutSet[] }>;
  onChange?: () => void;
}) {
  const [drafts, setDrafts] = useState(() => toDraft(initial));
  const listId = useId();

  function update(fn: (d: ExerciseDraft[]) => ExerciseDraft[]) {
    setDrafts(fn);
    onChange?.();
  }
  const editExercise = (key: number, fn: (e: ExerciseDraft) => ExerciseDraft) =>
    update((d) => d.map((e) => (e.key === key ? fn(e) : e)));

  function addSet(key: number) {
    editExercise(key, (e) => {
      // A new set starts as a copy of the last one: the usual case at the gym.
      const last = e.sets.at(-1);
      return { ...e, sets: [...e.sets, { key: nextKey(), reps: last?.reps ?? "", weight: last?.weight ?? "" }] };
    });
  }

  function addExercise() {
    update((d) => [...d, { key: nextKey(), name: "", sets: [{ key: nextKey(), reps: "", weight: "" }] }]);
    // Focus the new exercise's name once it is rendered.
    requestAnimationFrame(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>("[data-exercise-name]");
      inputs[inputs.length - 1]?.focus();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="exercises" value={serialize(drafts)} />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {drafts.length === 0 && (
        <p className="rounded-[20px] bg-surface p-[22px] text-[15px] leading-[1.55] text-neutral-400">
          Todavía no hay ejercicios. Añade el primero.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {drafts.map((e, i) => {
          const last = previous && e.name.trim() ? performanceFor(previous, e.name) : null;
          return (
            <li key={e.key} className="animate-pop rounded-[20px] bg-surface p-[18px] sm:p-[22px]">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="grid size-[30px] flex-none place-items-center rounded-full bg-text text-[13px] font-semibold text-bg tabular-nums"
                >
                  {i + 1}
                </span>
                <input
                  data-exercise-name
                  list={listId}
                  value={e.name}
                  onChange={(ev) => editExercise(e.key, (x) => ({ ...x, name: ev.target.value }))}
                  placeholder="Ejercicio (p. ej. Press banca)"
                  aria-label={`Nombre del ejercicio ${i + 1}`}
                  maxLength={60}
                  autoComplete="off"
                  className="h-[40px] min-w-0 flex-1 rounded-[12px] bg-transparent px-2 font-heading text-[19px] font-bold tracking-[-0.02em] text-text placeholder:font-sans placeholder:text-[15px] placeholder:font-normal placeholder:tracking-normal placeholder:text-neutral-600 hover:bg-step focus-visible:bg-step focus-visible:outline-none"
                />
                <button
                  type="button"
                  onClick={() => update((d) => d.filter((x) => x.key !== e.key))}
                  aria-label={`Quitar ${e.name || `ejercicio ${i + 1}`}`}
                  className={iconButtonClass}
                >
                  <Trash size={16} />
                </button>
              </div>
              {last && (
                <p className="mt-1 pl-[46px] text-[12.5px] text-neutral-500">
                  Última vez: <span className="tabular-nums">{formatSets(last.sets)}</span>
                </p>
              )}

              {e.sets.length > 0 && (
                <div className="mt-3 grid grid-cols-[30px_minmax(0,1fr)_minmax(0,1fr)_32px] items-center gap-x-2 gap-y-2">
                  <span aria-hidden />
                  <span className="text-center text-[11px] font-medium tracking-[0.08em] text-neutral-500 uppercase">Reps</span>
                  <span className="text-center text-[11px] font-medium tracking-[0.08em] text-neutral-500 uppercase">Kg</span>
                  <span aria-hidden />
                  {e.sets.map((s, j) => (
                    <SetRow
                      key={s.key}
                      index={j}
                      exercise={e.name || `ejercicio ${i + 1}`}
                      set={s}
                      onChange={(next) =>
                        editExercise(e.key, (x) => ({ ...x, sets: x.sets.map((y) => (y.key === s.key ? { ...y, ...next } : y)) }))
                      }
                      onRemove={() => editExercise(e.key, (x) => ({ ...x, sets: x.sets.filter((y) => y.key !== s.key) }))}
                    />
                  ))}
                </div>
              )}

              <button type="button" onClick={() => addSet(e.key)} className={`${secondaryButtonClass} mt-3 h-[36px] text-[13.5px]`}>
                <Plus size={14} weight="bold" />
                Serie
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={addExercise}
        className="pressable flex h-[52px] items-center justify-center gap-2 rounded-[20px] bg-step text-[15px] font-medium text-text transition-[background,scale] hover:bg-neutral-800"
      >
        <Plus size={16} weight="bold" />
        Añadir ejercicio
      </button>
    </div>
  );
}

function SetRow({
  index,
  exercise,
  set,
  onChange,
  onRemove,
}: {
  index: number;
  exercise: string;
  set: SetDraft;
  onChange: (next: Partial<SetDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <>
      <span className="text-center text-[13px] font-medium text-neutral-500 tabular-nums">{index + 1}</span>
      <input
        value={set.reps}
        onChange={(e) => onChange({ reps: e.target.value.replace(/[^\d]/g, "") })}
        inputMode="numeric"
        placeholder="0"
        aria-label={`Repeticiones, serie ${index + 1} de ${exercise}`}
        className={cellInput}
      />
      <input
        value={set.weight}
        onChange={(e) => onChange({ weight: e.target.value.replace(/[^\d.,]/g, "") })}
        inputMode="decimal"
        placeholder="—"
        aria-label={`Kilos, serie ${index + 1} de ${exercise} (vacío si es con tu peso)`}
        className={cellInput}
      />
      <button type="button" onClick={onRemove} aria-label={`Quitar serie ${index + 1} de ${exercise}`} className={iconButtonClass}>
        <X size={14} />
      </button>
    </>
  );
}
