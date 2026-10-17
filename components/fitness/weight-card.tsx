"use client";

import { ArrowDownRight, ArrowUpRight, X } from "@phosphor-icons/react";
import { useActionState, useRef, useState, useTransition } from "react";
import { deleteBodyWeight, logBodyWeight, restoreBodyWeight } from "@/app/(app)/fitness/actions";
import { FormError, iconButtonClass, inputClass, primaryButtonClass } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { formatKg, weightTrend } from "@/lib/fitness/stats";
import { daysBetween } from "@/lib/tasks/dates";
import type { BodyWeight } from "@/lib/fitness/types";
import type { FitnessFormState } from "@/lib/fitness/validation";

const shortDate = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return shortDate.format(new Date(Date.UTC(y, m - 1, day)));
};

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

      {weights.length >= 2 && <WeightChart weights={weights.slice(0, 60).toReversed()} />}

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

const W = 320;
const H = 120;
const PAD = { top: 12, right: 8, bottom: 20, left: 8 };

/** Single-series line, oldest to newest, with a crosshair tooltip. The list above is its table view. */
function WeightChart({ weights }: { weights: BodyWeight[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const values = weights.map((w) => w.weightKg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // At least ±1 kg of room so a flat series doesn't fill the box with noise.
  const span = Math.max(max - min, 2);
  const lo = (min + max) / 2 - span / 2;
  // Time on x, so gaps between weigh-ins keep their real length.
  const days = weights.map((w) => daysBetween(weights[0].date, w.date));
  const total = Math.max(days.at(-1)!, 1);
  const x = (i: number) => PAD.left + (days[i] / total) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - lo) / span) * (H - PAD.top - PAD.bottom);
  const path = weights.map((w, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(w.weightKg).toFixed(1)}`).join("");
  const active = hover === null ? weights.length - 1 : hover;
  const point = weights[active];

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    // Nearest weigh-in to the pointer.
    let best = 0;
    for (let i = 1; i < weights.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setHover(best);
  }

  return (
    <figure className="m-0 flex flex-col gap-1">
      <div className="flex justify-between text-[12px] text-neutral-500 tabular-nums" aria-live="polite">
        <span>
          {fmtDate(point.date)} · <span className="font-medium text-neutral-200">{formatKg(point.weightKg)}</span>
        </span>
        <span>
          {formatKg(min)} – {formatKg(max)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-none"
        role="img"
        aria-label={`Evolución del peso: de ${formatKg(weights[0].weightKg)} el ${fmtDate(weights[0].date)} a ${formatKg(weights.at(-1)!.weightKg)} el ${fmtDate(weights.at(-1)!.date)}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="var(--color-step)" strokeWidth={1} />
        {hover !== null && (
          <line x1={x(active)} x2={x(active)} y1={PAD.top - 4} y2={H - PAD.bottom} stroke="var(--color-neutral-700)" strokeWidth={1} />
        )}
        <path d={path} fill="none" stroke="var(--color-text)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(active)} cy={y(point.weightKg)} r={5} fill="var(--color-accent)" stroke="var(--color-text)" strokeWidth={2} />
        <text x={PAD.left} y={H - 4} fontSize={10} fill="var(--color-neutral-500)">
          {fmtDate(weights[0].date)}
        </text>
        <text x={W - PAD.right} y={H - 4} fontSize={10} textAnchor="end" fill="var(--color-neutral-500)">
          {fmtDate(weights.at(-1)!.date)}
        </text>
      </svg>
    </figure>
  );
}
