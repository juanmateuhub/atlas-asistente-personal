"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { iconButtonClass, secondaryButtonClass } from "@/components/ui/form";
import {
  WEEKDAYS,
  WEEKDAY_NAMES,
  formatDay,
  formatMonth,
  monthGrid,
  monthOf,
  shiftMonth,
  type MonthKey,
} from "@/lib/calendar/grid";
import { groupByDate, type AgendaItem } from "@/lib/calendar/types";
import { DayAgenda } from "./day-agenda";

const MARK = {
  exam: "bg-accent",
  event: "bg-sky",
  task: "bg-line",
} as const;

export function CalendarView({
  month,
  initialDay,
  today,
  items,
}: {
  month: MonthKey;
  initialDay: string;
  today: string;
  items: AgendaItem[];
}) {
  const [selected, setSelected] = useState(initialDay);
  // Remember the month we last showed to slide the grid in the right direction.
  const [shown, setShown] = useState({ month, direction: 0 });
  if (shown.month !== month) {
    setShown({ month, direction: month > shown.month ? 1 : -1 });
    setSelected(initialDay);
  }

  const weeks = useMemo(() => monthGrid(month), [month]);
  const byDate = useMemo(() => groupByDate(items), [items]);
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const href = (m: MonthKey) => (m === monthOf(today) ? "/calendario" : `/calendario?mes=${m}`);

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section aria-labelledby="month-title" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="month-title" aria-live="polite" className="text-lead font-medium">
            {formatMonth(month)}
          </h2>
          <div className="flex items-center gap-1">
            {month !== monthOf(today) && (
              <Link href="/calendario" scroll={false} className={`${secondaryButtonClass} mr-2 px-4 py-2 text-sm`}>
                Hoy
              </Link>
            )}
            <Link href={href(prev)} scroll={false} aria-label={`Ir a ${formatMonth(prev)}`} className={iconButtonClass}>
              <ChevronLeft aria-hidden className="size-5" />
            </Link>
            <Link href={href(next)} scroll={false} aria-label={`Ir a ${formatMonth(next)}`} className={iconButtonClass}>
              <ChevronRight aria-hidden className="size-5" />
            </Link>
          </div>
        </div>

        <div role="grid" aria-labelledby="month-title" className="flex flex-col gap-1 overflow-hidden">
          <div role="row" className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d, i) => (
              <span key={d} role="columnheader" aria-label={WEEKDAY_NAMES[i]} className="py-2 text-center text-xs font-medium text-muted">
                {d}
              </span>
            ))}
          </div>

          <AnimatePresence mode="popLayout" initial={false} custom={shown.direction}>
            <motion.div
              key={month}
              custom={shown.direction}
              variants={{
                enter: (dir: number) => ({ opacity: 0, x: dir * 32 }),
                center: { opacity: 1, x: 0 },
                exit: (dir: number) => ({ opacity: 0, x: dir * -32, transition: { duration: 0.12 } }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              className="flex flex-col gap-1"
            >
              {weeks.map((week) => (
                <div key={week[0]} role="row" className="grid grid-cols-7 gap-1">
                  {week.map((date) => (
                    <DayCell
                      key={date}
                      date={date}
                      inMonth={monthOf(date) === month}
                      isToday={date === today}
                      isSelected={date === selected}
                      items={byDate.get(date) ?? []}
                      onSelect={() => setSelected(date)}
                    />
                  ))}
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Leyenda">
          <li className="flex items-center gap-2">
            <span aria-hidden className={`size-2 rounded-full ${MARK.exam}`} /> Examen
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className={`size-2 rounded-full ${MARK.event}`} /> Evento
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className={`size-2 rounded-full ${MARK.task}`} /> Tarea
          </li>
        </ul>
      </section>

      <DayAgenda day={selected} items={byDate.get(selected) ?? []} today={today} />
    </div>
  );
}

function DayCell({
  date,
  inMonth,
  isToday,
  isSelected,
  items,
  onSelect,
}: {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  items: AgendaItem[];
  onSelect: () => void;
}) {
  const dayNumber = Number(date.slice(8));
  const label = `${formatDay(date)}${items.length ? `, ${items.length} ${items.length === 1 ? "elemento" : "elementos"}` : ""}`;

  return (
    <button
      type="button"
      role="gridcell"
      aria-selected={isSelected}
      aria-label={label}
      onClick={onSelect}
      className={`pressable relative flex aspect-square flex-col items-center justify-start gap-1 rounded-atlas pt-2 md:aspect-auto md:h-16 ${
        inMonth ? "text-ink" : "text-muted/60"
      } ${isSelected ? "" : "hover:bg-line/20"}`}
    >
      {isSelected && (
        <motion.span layoutId="calendar-selected" aria-hidden className="absolute inset-0 rounded-atlas bg-line/30" />
      )}
      <span
        className={`relative flex size-7 items-center justify-center rounded-full text-sm tabular-nums ${
          isToday ? "bg-accent font-bold text-white" : ""
        }`}
      >
        {dayNumber}
      </span>

      {/* Dots by kind; titles live in the day agenda next to the grid. */}
      <span aria-hidden className="relative flex gap-0.5">
        {items.slice(0, 3).map((item) => (
          <span key={`${item.kind}-${item.id}`} className={`size-1.5 rounded-full ${MARK[item.kind]}`} />
        ))}
      </span>
    </button>
  );
}
