"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
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
import { DayAgenda, KIND_COLOR } from "./day-agenda";

const ROW_H = 66;
const navButtonClass =
  "pressable grid size-[34px] place-items-center rounded-full text-neutral-400 transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] hover:text-neutral-200";

export function CalendarView({
  month,
  initialDay,
  today,
  items,
  subjects,
}: {
  month: MonthKey;
  initialDay: string;
  today: string;
  items: AgendaItem[];
  subjects: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState(initialDay);
  const [shownMonth, setShownMonth] = useState(month);
  if (shownMonth !== month) {
    setShownMonth(month);
    setSelected(initialDay);
  }

  const weeks = useMemo(() => monthGrid(month), [month]);
  const days = weeks.flat();
  const byDate = useMemo(() => groupByDate(items), [items]);
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const href = (m: MonthKey) => (m === monthOf(today) ? "/calendario" : `/calendario?mes=${m}`);
  const selIndex = days.indexOf(selected);

  return (
    <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]">
      <section aria-labelledby="month-title" className="flex min-w-0 flex-col gap-[18px]">
        <div className="flex items-center justify-between">
          <h2
            id="month-title"
            aria-live="polite"
            className="m-0 text-[clamp(20px,2.2vw,26px)] tracking-[-0.025em] whitespace-nowrap"
          >
            {formatMonth(month)}
          </h2>
          <div className="flex gap-1">
            <Link href={href(prev)} scroll={false} aria-label={`Ir a ${formatMonth(prev)}`} className={navButtonClass}>
              <CaretLeft size={16} />
            </Link>
            <Link href={href(next)} scroll={false} aria-label={`Ir a ${formatMonth(next)}`} className={navButtonClass}>
              <CaretRight size={16} />
            </Link>
          </div>
        </div>

        <div role="grid" aria-labelledby="month-title">
          <div role="row" className="grid grid-cols-7">
            {WEEKDAYS.map((d, i) => (
              <span
                key={d}
                role="columnheader"
                aria-label={WEEKDAY_NAMES[i]}
                className="pb-2 text-center text-[11px] font-medium tracking-[0.08em] text-neutral-600"
              >
                {d}
              </span>
            ))}
          </div>

          {/* key: the new month fades in; the selector then slides between days. */}
          <div key={month} className="relative grid animate-fade grid-cols-7" style={{ gridAutoRows: ROW_H }}>
            <div
              aria-hidden
              className="pointer-events-none absolute p-[5px]"
              style={{
                width: "calc(100% / 7)",
                height: ROW_H,
                left: `calc(${selIndex % 7} * 100% / 7)`,
                top: Math.floor(Math.max(selIndex, 0) / 7) * ROW_H,
                opacity: selIndex < 0 ? 0 : 1,
                transition:
                  "left .5s cubic-bezier(.34,1.35,.5,1), top .5s cubic-bezier(.34,1.35,.5,1), opacity .2s",
              }}
            >
              <div className="size-full rounded-[16px] bg-surface" />
            </div>
            {weeks.map((week) => (
              <div key={week[0]} role="row" className="contents">
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
          </div>
        </div>

        <ul className="flex gap-[18px] pt-[6px] text-[12.5px] text-neutral-500" aria-label="Leyenda">
          <li className="flex items-center gap-[7px]">
            <span
              aria-hidden
              className="size-[7px] rounded-full"
              style={{ background: KIND_COLOR.exam }}
            />
            Examen
          </li>
          <li className="flex items-center gap-[7px]">
            <span aria-hidden className="size-[7px] rounded-full" style={{ background: KIND_COLOR.event }} />
            Evento
          </li>
          <li className="flex items-center gap-[7px]">
            <span aria-hidden className="size-[7px] rounded-full" style={{ background: KIND_COLOR.task }} />
            Tarea
          </li>
        </ul>
      </section>

      <DayAgenda
        day={selected}
        items={byDate.get(selected) ?? []}
        today={today}
        subjects={subjects}
        goToday={
          selected === today
            ? null
            : monthOf(today) === month
              ? { onClick: () => setSelected(today) }
              : { href: "/calendario" }
        }
      />
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
  // One dot per kind present that day; open tasks only.
  const kinds = [...new Set(items.filter((i) => i.kind !== "task" || !i.done).map((i) => i.kind))];

  return (
    <button
      type="button"
      role="gridcell"
      aria-selected={isSelected}
      aria-label={label}
      onClick={onSelect}
      className="relative flex cursor-pointer flex-col items-center justify-center gap-[5px] rounded-[16px] border-0 bg-transparent active:scale-90"
      style={{ transition: "scale .2s cubic-bezier(.34,1.8,.5,1)" }}
    >
      <span
        className="grid size-8 place-items-center rounded-full text-[14.5px] tabular-nums"
        style={{
          fontWeight: isToday || isSelected ? 700 : 450,
          color: isToday ? "var(--color-on-accent)" : inMonth ? "var(--color-neutral-200)" : "var(--color-neutral-700)",
          background: isToday ? "var(--color-accent)" : "transparent",
        }}
      >
        {dayNumber}
      </span>
      <span aria-hidden className="flex h-[5px] gap-[3px]">
        {kinds.map((k) => (
          <span key={k} className="size-[5px] rounded-full" style={{ background: KIND_COLOR[k] }} />
        ))}
      </span>
    </button>
  );
}
