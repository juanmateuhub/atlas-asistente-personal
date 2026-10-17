"use client";

import { useState } from "react";
import { daysBetween } from "@/lib/tasks/dates";

export type ChartPoint = { date: string; value: number };

const shortDate = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
export const fmtShortDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return shortDate.format(new Date(Date.UTC(y, m - 1, day)));
};

const W = 320;
const H = 120;
const PAD = { top: 12, right: 8, bottom: 20, left: 8 };

/**
 * Single-series line over time (oldest first), ink line with a yellow marker on
 * the active point and a crosshair on hover/touch. The caller shows the data as
 * a list too, which is its table view.
 */
export function LineChart({
  points,
  format,
  label,
  minSpan = 2,
}: {
  points: ChartPoint[];
  format: (value: number) => string;
  /** Accessible name, e.g. "Evolución del peso". */
  label: string;
  /** Smallest value range drawn, so a flat series doesn't fill the box with noise. */
  minSpan?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, minSpan);
  const lo = (min + max) / 2 - span / 2;
  // Time on x, so gaps between entries keep their real length.
  const days = points.map((p) => daysBetween(points[0].date, p.date));
  const total = Math.max(days.at(-1) ?? 0, 1);
  const single = points.length === 1;
  const x = (i: number) => (single ? W / 2 : PAD.left + (days[i] / total) * (W - PAD.left - PAD.right));
  const y = (v: number) => PAD.top + (1 - (v - lo) / span) * (H - PAD.top - PAD.bottom);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const active = hover ?? points.length - 1;
  const point = points[active];
  const first = points[0];
  const last = points.at(-1)!;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setHover(best);
  }

  return (
    <figure className="m-0 flex flex-col gap-1">
      <div className="flex justify-between text-[12px] text-neutral-500 tabular-nums" aria-live="polite">
        <span>
          {fmtShortDate(point.date)} · <span className="font-medium text-neutral-200">{format(point.value)}</span>
        </span>
        <span>
          {format(min)} – {format(max)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-none"
        role="img"
        aria-label={`${label}: de ${format(first.value)} el ${fmtShortDate(first.date)} a ${format(last.value)} el ${fmtShortDate(last.date)}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="var(--color-step)" strokeWidth={1} />
        {hover !== null && (
          <line x1={x(active)} x2={x(active)} y1={PAD.top - 4} y2={H - PAD.bottom} stroke="var(--color-neutral-700)" strokeWidth={1} />
        )}
        <path d={path} fill="none" stroke="var(--color-text)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(active)} cy={y(point.value)} r={5} fill="var(--color-accent)" stroke="var(--color-text)" strokeWidth={2} />
        <text x={PAD.left} y={H - 4} fontSize={10} fill="var(--color-neutral-500)">
          {fmtShortDate(first.date)}
        </text>
        {!single && (
          <text x={W - PAD.right} y={H - 4} fontSize={10} textAnchor="end" fill="var(--color-neutral-500)">
            {fmtShortDate(last.date)}
          </text>
        )}
      </svg>
    </figure>
  );
}
