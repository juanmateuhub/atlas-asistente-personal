"use client";

import { CaretRight, Trophy } from "@phosphor-icons/react";
import { useState } from "react";
import { Dialog, useDialog } from "@/components/ui/dialog";
import { formatKg, type ExercisePoint, type PersonalRecord } from "@/lib/fitness/stats";
import { LineChart, fmtShortDate } from "./line-chart";

/** Best marks as trophies; each opens the evolution of that exercise's heaviest set. */
export function RecordsGrid({ records, history }: { records: PersonalRecord[]; history: Record<string, ExercisePoint[]> }) {
  const dialog = useDialog();
  const [open, setOpen] = useState<PersonalRecord | null>(null);
  const points = open ? (history[open.name] ?? []) : [];

  return (
    <section aria-labelledby="records-title">
      <h2 id="records-title" className="m-0 mb-4 text-[26px] tracking-[-0.035em]">
        Mejores marcas
      </h2>
      <ul className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr))]">
        {records.map((r) => (
          <li key={r.name}>
            <button
              type="button"
              onClick={() => {
                setOpen(r);
                dialog.open();
              }}
              className="pressable group flex w-full cursor-pointer flex-col gap-1 rounded-[18px] bg-surface p-[18px] text-left transition-[background,scale] hover:bg-[color-mix(in_srgb,var(--color-surface)_92%,var(--color-accent))]"
            >
              <span className="flex items-center gap-2 text-[13px] font-medium text-neutral-500">
                <Trophy size={14} weight="fill" color="var(--color-accent-ink)" />
                <span className="flex-1 truncate">{r.name}</span>
                <CaretRight size={14} className="transition-transform group-hover:translate-x-[2px]" />
              </span>
              <span className="font-heading text-[28px] leading-[1.05] font-extrabold tracking-[-0.04em] tabular-nums">{formatKg(r.weight)}</span>
              <span className="text-[12.5px] text-neutral-500 tabular-nums">
                {r.reps} {r.reps === 1 ? "rep" : "reps"} · 1RM est. {formatKg(Math.round(r.oneRepMax * 2) / 2)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog dialogRef={dialog.ref} title={open?.name ?? ""} subtitle="Peso de tu mejor serie en cada entreno" onClose={dialog.close}>
        {open && points.length > 0 && (
          <div key={open.name} className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Récord" value={formatKg(open.weight)} />
              <Stat label="1RM est." value={formatKg(Math.round(open.oneRepMax * 2) / 2)} />
              <Stat
                label="Progreso"
                value={`${points.at(-1)!.weight - points[0].weight >= 0 ? "+" : "−"}${formatKg(Math.abs(points.at(-1)!.weight - points[0].weight))}`}
              />
            </div>
            {points.length > 1 ? (
              <LineChart label={`Evolución de ${open.name}`} format={formatKg} minSpan={5} points={points.map((p) => ({ date: p.date, value: p.weight }))} />
            ) : (
              <p className="m-0 rounded-[14px] bg-step px-4 py-3 text-[14px] text-neutral-400">
                La gráfica aparece cuando lo hayas entrenado en dos días distintos.
              </p>
            )}
            <ul className="flex max-h-[200px] flex-col overflow-y-auto">
              {points.toReversed().map((p) => (
                <li key={p.date} className="flex items-center justify-between gap-3 py-[6px] text-[14px]">
                  <span className="text-neutral-500">{fmtShortDate(p.date)}</span>
                  <span className="ml-auto tabular-nums">
                    <span className="font-medium">{formatKg(p.weight)}</span>
                    <span className="text-neutral-500"> × {p.reps}</span>
                  </span>
                  {p.weight === open.weight && (
                    <Trophy size={14} weight="fill" color="var(--color-accent-ink)" aria-label="Récord" />
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Dialog>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[14px] bg-step px-3 py-[10px]">
      <span className="text-[11px] font-medium tracking-[0.08em] text-neutral-500 uppercase">{label}</span>
      <span className="text-[15px] font-semibold tabular-nums">{value}</span>
    </div>
  );
}
