"use client";

import { PencilSimple, Warning } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useActionState, useMemo, useState } from "react";
import { resetExerciseMuscles, setExerciseMuscles } from "@/app/(app)/fitness/actions";
import { Dialog, useDialog } from "@/components/ui/dialog";
import { Field, FormError, iconButtonClass, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import {
  MUSCLES,
  VOLUME_RANGE,
  muscleLabel,
  volumeLevel,
  volumeStatus,
  type MuscleId,
  type MuscleMap,
  type VolumeLevel,
  type VolumeReport,
} from "@/lib/fitness/muscles";
import type { FitnessFormState } from "@/lib/fitness/validation";
import { LEVEL_COLORS } from "./body-3d-colors";

// three.js only loads in the browser, and only on this screen.
const Body3D = dynamic(() => import("./body-3d").then((m) => m.Body3D), {
  ssr: false,
  loading: () => <div className="size-full animate-skeleton rounded-[18px] bg-step" />,
});

const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

export type ExerciseMuscles = { name: string; muscles: MuscleMap | null; custom: boolean };

/** Weekly volume per muscle group: 3D body, legend, ranked list and the exercise → muscles mapping. */
export function MusclePanel({
  week,
  month,
  exercises,
}: {
  week: VolumeReport;
  /** Weekly average over the last 4 weeks. */
  month: VolumeReport;
  exercises: ExerciseMuscles[];
}) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [selected, setSelected] = useState<MuscleId | null>(null);
  const report = period === "week" ? week : month;
  const levels = useMemo(
    () => Object.fromEntries(report.muscles.map((m) => [m.id, volumeLevel(m.sets)])) as Record<MuscleId, VolumeLevel>,
    [report],
  );
  const ranked = report.muscles.toSorted((a, b) => b.sets - a.sets);
  const detail = selected ? report.muscles.find((m) => m.id === selected)! : null;
  const unknown = exercises.filter((e) => !e.muscles);

  return (
    <section id="musculos" aria-labelledby="muscles-title" className="flex scroll-mt-6 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="muscles-title" className="m-0 text-[26px] tracking-[-0.035em]">
          Músculos
        </h2>
        <div className="flex items-center gap-2">
          <div role="radiogroup" aria-label="Periodo" className="flex rounded-full bg-step p-1">
            {(
              [
                ["week", "7 días"],
                ["month", "Media 4 sem."],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={period === value}
                onClick={() => setPeriod(value)}
                className="rounded-full px-3 py-[6px] text-[13px] font-medium transition-colors"
                style={{ background: period === value ? "var(--color-surface)" : "transparent", color: period === value ? "var(--color-text)" : "var(--color-neutral-500)" }}
              >
                {label}
              </button>
            ))}
          </div>
          <ExerciseMusclesButton exercises={exercises} />
        </div>
      </div>

      {unknown.length > 0 && (
        <p className="m-0 flex items-center gap-2 rounded-[14px] bg-accent-900 px-4 py-3 text-[13.5px] text-neutral-300">
          <Warning size={16} weight="fill" color="var(--color-accent-ink)" className="flex-none" />
          <span>
            Sin grupo muscular: <strong>{unknown.map((e) => e.name).join(", ")}</strong>. No cuentan en el volumen hasta que les asignes uno.
          </span>
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 rounded-[22px] bg-surface p-[18px] sm:p-[22px] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <div className="h-[380px] md:h-[440px]">
            <Body3D levels={levels} selected={selected} onSelect={setSelected} />
          </div>
          <Legend />
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          {detail ? (
            <div className="flex flex-col gap-2 rounded-[16px] bg-step p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-heading text-[22px] font-bold tracking-[-0.03em]">{detail.label}</span>
                <button type="button" onClick={() => setSelected(null)} className="text-[13px] font-medium text-accent-ink">
                  Ver todos
                </button>
              </div>
              <span className="text-[14px] text-neutral-400">
                {fmt(detail.sets)} series/semana · {volumeStatus(detail.sets)}
                {detail.kg > 0 && ` · ${detail.kg.toLocaleString("es-ES")} kg`}
              </span>
              {detail.exercises.length > 0 ? (
                <ul className="m-0 flex flex-col gap-1 pl-0">
                  {detail.exercises.map((e) => (
                    <li key={e.name} className="flex justify-between gap-3 text-[14px]">
                      <span className="truncate">{e.name}</span>
                      <span className="tabular-nums text-neutral-500">{fmt(e.sets)} series</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-[13.5px] text-neutral-500">Ningún ejercicio lo ha trabajado en este periodo.</span>
              )}
            </div>
          ) : (
            <p className="m-0 text-[13px] text-neutral-500">
              Series por semana. Toca un músculo en el cuerpo o en la lista para ver qué ejercicios lo trabajan. Rango orientativo: {VOLUME_RANGE.low}–{VOLUME_RANGE.high}.
            </p>
          )}

          <ul className="m-0 flex flex-col pl-0">
            {ranked.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelected(selected === m.id ? null : m.id)}
                  aria-pressed={selected === m.id}
                  className="flex w-full items-center gap-3 rounded-[12px] px-2 py-[7px] text-left transition-colors hover:bg-step"
                  style={{ background: selected === m.id ? "var(--color-step)" : undefined }}
                >
                  <span className="w-[104px] flex-none truncate text-[14px] font-medium">{m.label}</span>
                  <span className="relative h-[10px] flex-1 overflow-hidden rounded-full bg-step">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${Math.min(100, (m.sets / 25) * 100)}%`, background: LEVEL_COLORS[volumeLevel(m.sets)] }}
                    />
                    {/* The recommended range, as two ticks. */}
                    <span aria-hidden className="absolute inset-y-0 w-[2px] bg-neutral-700" style={{ left: `${(VOLUME_RANGE.low / 25) * 100}%` }} />
                    <span aria-hidden className="absolute inset-y-0 w-[2px] bg-neutral-700" style={{ left: `${(VOLUME_RANGE.high / 25) * 100}%` }} />
                  </span>
                  <span className="w-[44px] flex-none text-right text-[13px] tabular-nums text-neutral-400">{fmt(m.sets)}</span>
                  <span className="sr-only">series por semana, {volumeStatus(m.sets)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Legend() {
  const steps = ["0", "<5", "5–10", "10–15", "15–20", ">20"];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-[3px]" aria-hidden>
        {LEVEL_COLORS.map((c) => (
          <span key={c} className="h-2 flex-1 rounded-[2px]" style={{ background: c }} />
        ))}
      </div>
      <div className="flex text-[11px] text-neutral-500 tabular-nums">
        {steps.map((s) => (
          <span key={s} className="flex-1 text-center">
            {s}
          </span>
        ))}
      </div>
      <span className="text-center text-[11px] text-neutral-500">series por semana</span>
    </div>
  );
}

/** Every exercise you have used and its muscles; each can be changed or reset to the app's guess. */
function ExerciseMusclesButton({ exercises }: { exercises: ExerciseMuscles[] }) {
  const dialog = useDialog();
  const [editing, setEditing] = useState<ExerciseMuscles | null>(null);
  return (
    <>
      <button type="button" onClick={dialog.open} className={`${secondaryButtonClass} h-[36px] text-[13.5px]`}>
        Ejercicios
      </button>
      <Dialog dialogRef={dialog.ref} title="Ejercicios y músculos" subtitle="El primero es el principal; los demás cuentan la mitad." onClose={dialog.close}>
        {editing ? (
          <MuscleForm key={editing.name} exercise={editing} onDone={() => setEditing(null)} />
        ) : exercises.length === 0 ? (
          <p className="m-0 text-[14px] text-neutral-400">Aún no has usado ningún ejercicio.</p>
        ) : (
          <ul className="m-0 flex max-h-[60vh] flex-col overflow-y-auto pl-0">
            {exercises.map((e) => (
              <li key={e.name} className="flex items-center gap-3 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14.5px] font-medium">{e.name}</span>
                  <span className="truncate text-[12.5px]" style={{ color: e.muscles ? "var(--color-neutral-500)" : "var(--color-accent-ink)" }}>
                    {e.muscles ? e.muscles.map(muscleLabel).join(", ") : "Sin grupo"}
                    {e.custom && " · personalizado"}
                  </span>
                </span>
                <button type="button" onClick={() => setEditing(e)} aria-label={`Editar músculos de ${e.name}`} className={iconButtonClass}>
                  <PencilSimple size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </>
  );
}

function MuscleForm({ exercise, onDone }: { exercise: ExerciseMuscles; onDone: () => void }) {
  const toast = useToast();
  const [primary, setPrimary] = useState<MuscleId | "">(exercise.muscles?.[0] ?? "");
  const [state, action, pending] = useActionState(async (prev: FitnessFormState, fd: FormData) => {
    const reset = fd.get("intent") === "reset";
    const result = await (reset ? resetExerciseMuscles : setExerciseMuscles)(prev, fd);
    if (result.ok) {
      toast(reset ? "Músculos restablecidos" : "Músculos guardados");
      onDone();
    }
    return result;
  }, {});
  const secondary = new Set(exercise.muscles?.slice(1) ?? []);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="exercise" value={exercise.name} />
      <p className="m-0 font-heading text-[19px] font-bold tracking-[-0.02em]">{exercise.name}</p>
      <Field label="Músculo principal" htmlFor="muscle-primary">
        <select
          id="muscle-primary"
          name="primary"
          value={primary}
          onChange={(e) => setPrimary(e.target.value as MuscleId)}
          required
          className={inputClass}
        >
          <option value="" disabled>
            Elige uno
          </option>
          {MUSCLES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-[12.5px] font-medium text-neutral-400">Secundarios (hasta 3)</legend>
        <div className="flex flex-wrap gap-2">
          {MUSCLES.filter((m) => m.id !== primary).map((m) => (
            <label key={m.id} className="cursor-pointer">
              <input type="checkbox" name="secondary" value={m.id} defaultChecked={secondary.has(m.id)} className="peer sr-only" />
              <span className="inline-flex rounded-full bg-step px-3 py-[6px] text-[13px] font-medium text-neutral-400 transition-colors peer-checked:bg-text peer-checked:text-bg peer-focus-visible:outline-2 peer-focus-visible:outline-text">
                {m.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <FormError message={state.error} />
      <div className="flex flex-wrap justify-end gap-2">
        {exercise.custom && (
          <button type="submit" name="intent" value="reset" disabled={pending} className={`${secondaryButtonClass} mr-auto`}>
            Restablecer
          </button>
        )}
        <button type="button" onClick={onDone} className={secondaryButtonClass}>
          Volver
        </button>
        <button type="submit" name="intent" value="save" disabled={pending} className={primaryButtonClass}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
