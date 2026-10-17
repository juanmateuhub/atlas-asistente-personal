"use client";

import { ArrowDownRight, ArrowUpRight, X } from "@phosphor-icons/react";
import { useActionState, useRef, useTransition } from "react";
import { deleteBodyWeight, logBodyWeight, restoreBodyWeight } from "@/app/(app)/fitness/actions";
import { FormError, iconButtonClass, inputClass, primaryButtonClass } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { formatKg, weightTrend } from "@/lib/fitness/stats";
import type { BodyWeight } from "@/lib/fitness/types";
import type { FitnessFormState } from "@/lib/fitness/validation";
import { LineChart, fmtShortDate } from "./line-chart";

const fmtDate = fmtShortDate;

/** Latest weight, its trend, a chart of the last weigh-ins and the form to log today's. */
export function WeightCard({ weights, today }: { weights: BodyWeight[]; today: string }) {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: FitnessFormState, fd: FormData) => {
    const result = await logBodyWeight(prev, fd);
    if (result.ok) {
      toast("Peso apuntado");
      formRef.current?.querySelector<HTMLInputElement>("[name=weight]")?.blur();
    }
    return result;
  }, {});
  const [, startTransition] = useTransition();
  const trend = weightTrend(weights);
  const todays = weights.find((w) => w.date === today);

  function remove(w: BodyWeight) {
    startTransition(async () => {
      const result = await deleteBodyWeight(w.id);
      if (result.ok && result.row) {
        const row = result.row;
        toast(`Borrado ${formatKg(w.weightKg)} del ${fmtDate(w.date)}`, () => startTransition(() => restoreBodyWeight(row)));
      }
    });
  }

  return (
    <section aria-labelledby="weight-title" className="flex flex-col gap-5 rounded-[22px] bg-surface p-[22px]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="weight-title" className="m-0 text-[13px] font-medium tracking-normal text-neutral-500">
            Peso corporal
          </h2>
          {trend ? (
            <p className="m-0 flex items-baseline gap-3">
              <span className="font-heading text-[44px] leading-none font-extrabold tracking-[-0.05em] tabular-nums">
                {formatKg(trend.latest.weightKg).replace(" kg", "")}
                <span className="ml-1 text-[18px] font-bold tracking-[-0.02em] text-neutral-500">kg</span>
              </span>
            </p>
          ) : (
            <p className="m-0 text-[15px] text-neutral-400">Apunta tu peso para ver cómo evoluciona.</p>
          )}
          {trend && (
            <p className="m-0 flex items-center gap-1 text-[13px] text-neutral-500">
              {trend.change !== null && trend.change !== 0 && (
                <>
                  {trend.change > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  <span className="font-medium text-neutral-300 tabular-nums">
                    {trend.change > 0 ? "+" : "−"}
                    {formatKg(Math.abs(trend.change))}
                  </span>
                  <span>desde el {fmtDate(trend.since!)}</span>
                  <span aria-hidden>·</span>
                </>
              )}
              {trend.change === 0 && <span>Igual que el {fmtDate(trend.since!)} ·</span>}
              <span>{trend.latest.date === today ? "hoy" : fmtDate(trend.latest.date)}</span>
            </p>
          )}
        </div>
      </div>

      {weights.length >= 2 && (
        <LineChart
          label="Evolución del peso"
          format={formatKg}
          points={weights
            .slice(0, 60)
            .toReversed()
            .map((w) => ({ date: w.date, value: w.weightKg }))}
        />
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="date" value={today} />
        <div className="flex gap-2">
          <label htmlFor="weight-input" className="sr-only">
            Peso de hoy en kg
          </label>
          <input
            id="weight-input"
            name="weight"
            inputMode="decimal"
            placeholder={todays ? `Hoy: ${formatKg(todays.weightKg)}` : "Peso de hoy (kg)"}
            autoComplete="off"
            required
            className={inputClass}
          />
          <button type="submit" disabled={pending} className={`${primaryButtonClass} h-[44px] flex-none`}>
            {pending ? "Guardando…" : todays ? "Cambiar" : "Apuntar"}
          </button>
        </div>
        <FormError message={state.error} />
      </form>

      {weights.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none text-[13px] font-medium text-accent-ink [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Ver registros</span>
            <span className="hidden group-open:inline">Ocultar registros</span>
          </summary>
          <ul className="mt-2 flex flex-col">
            {weights.slice(0, 30).map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 py-[6px] text-[14px]">
                <span className="text-neutral-500">{fmtDate(w.date)}</span>
                <span className="ml-auto font-medium tabular-nums">{formatKg(w.weightKg)}</span>
                <button type="button" onClick={() => remove(w)} aria-label={`Borrar el peso del ${fmtDate(w.date)}`} className={iconButtonClass}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
