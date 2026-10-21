"use client";

import { useState } from "react";
import { muscleLabel, type MuscleId, type VolumeLevel } from "@/lib/fitness/muscles";
import { LEVEL_COLORS } from "./body-colors";
import { BODY_BACK, BODY_FRONT, type BodySide } from "./body-paths";

const SELECTED_COLOR = "var(--color-text)";
/** Parts that aren't one of our muscle groups (adductors, shins, knees…): body, not data. */
const BODY_COLOR = "var(--color-step)";
const HAIR_COLOR = "#cfcfca";

/** The anatomy's parts → our muscle groups. Anything missing is drawn as plain body. */
const PART_MUSCLE: Record<string, MuscleId> = {
  chest: "pecho",
  abs: "abdomen",
  obliques: "abdomen",
  biceps: "biceps",
  triceps: "triceps",
  forearm: "antebrazos",
  deltoids: "hombros",
  trapezius: "trapecio",
  "upper-back": "espalda",
  "lower-back": "lumbares",
  gluteal: "gluteos",
  quadriceps: "cuadriceps",
  hamstring: "isquios",
  calves: "gemelos",
};

// Cropped to the figure; the back is drawn 724 units to the right of the front.
const VIEWBOX = { front: "40 100 644 1265", back: "764 100 644 1265" } as const;

const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

/**
 * Front and back anatomy, each muscle group coloured by its weekly sets. Tap a
 * muscle to select it. Decorative for screen readers: the list next to it
 * carries the same data.
 */
export function BodyMap({
  levels,
  sets,
  selected,
  onSelect,
}: {
  levels: Record<MuscleId, VolumeLevel>;
  sets: Record<MuscleId, number>;
  selected: MuscleId | null;
  onSelect: (id: MuscleId | null) => void;
}) {
  const [hovered, setHovered] = useState<MuscleId | null>(null);
  const shown = hovered ?? selected;

  return (
    <div className="relative flex h-full w-full flex-col">
      <div aria-hidden className="flex min-h-0 flex-1 items-stretch justify-center gap-2" onClick={() => onSelect(null)}>
        <Figure side={BODY_FRONT} viewBox={VIEWBOX.front} label="Frente" {...{ levels, selected, hovered, setHovered, onSelect }} />
        <Figure side={BODY_BACK} viewBox={VIEWBOX.back} label="Espalda" {...{ levels, selected, hovered, setHovered, onSelect }} />
      </div>
      <p
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 m-0 -translate-x-1/2 rounded-full bg-text px-3 py-[5px] text-[12.5px] font-medium whitespace-nowrap text-bg transition-opacity"
        style={{ opacity: shown ? 1 : 0 }}
      >
        {shown && `${muscleLabel(shown)} · ${fmt(sets[shown] ?? 0)} series`}
      </p>
    </div>
  );
}

function Figure({
  side,
  viewBox,
  label,
  levels,
  selected,
  hovered,
  setHovered,
  onSelect,
}: {
  side: BodySide;
  viewBox: string;
  label: string;
  levels: Record<MuscleId, VolumeLevel>;
  selected: MuscleId | null;
  hovered: MuscleId | null;
  setHovered: (id: MuscleId | null) => void;
  onSelect: (id: MuscleId | null) => void;
}) {
  return (
    <figure className="m-0 flex min-w-0 flex-1 flex-col items-center gap-1">
      <svg viewBox={viewBox} className="min-h-0 w-full flex-1" preserveAspectRatio="xMidYMid meet">
        <path d={side.outline} fill="var(--color-bg)" />
        {side.parts.map(({ part, d }, i) => {
          const muscle = PART_MUSCLE[part];
          if (!muscle) {
            const fill = part === "hair" ? HAIR_COLOR : BODY_COLOR;
            return d.map((path, j) => <path key={`${i}-${j}`} d={path} fill={fill} />);
          }
          const fill = muscle === selected ? SELECTED_COLOR : LEVEL_COLORS[levels[muscle] ?? 0];
          return (
            <g
              key={`${i}-${part}`}
              fill={fill}
              className="cursor-pointer transition-[fill,filter] duration-200"
              style={{ filter: hovered === muscle && muscle !== selected ? "brightness(0.9)" : undefined }}
              onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(muscle)}
              onPointerLeave={() => setHovered(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(muscle === selected ? null : muscle);
              }}
            >
              {d.map((path, j) => (
                <path key={j} d={path} />
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-[11.5px] font-medium tracking-[0.08em] text-neutral-500 uppercase">{label}</figcaption>
    </figure>
  );
}
