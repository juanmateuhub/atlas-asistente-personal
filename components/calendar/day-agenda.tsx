"use client";

import { PencilSimple, Trash } from "@phosphor-icons/react";
import Link from "next/link";
import { deleteEvent, updateEvent } from "@/app/(app)/calendario/actions";
import { ActionDialog } from "@/components/ui/action-dialog";
import { iconButtonClass } from "@/components/ui/form";
import type { AgendaItem } from "@/lib/calendar/types";
import { AddToDay } from "./add-to-day";
import { EventFields } from "./event-fields";

/** Dot colour per kind, as in the redesign's legend. */
/** Exams are the most important, so they get full ink; events the signal yellow; tasks grey. */
export const KIND_COLOR = {
  exam: "var(--color-text)",
  event: "var(--color-accent-600)",
  task: "var(--color-neutral-600)",
} as const;

const weekdayFmt = new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: "UTC" });
const monthYearFmt = new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "UTC" });

function parts(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = weekdayFmt.format(date);
  return {
    weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    day: d,
    month: `de ${monthYearFmt.format(date)} de ${y}`,
  };
}

function timeLabel(item: AgendaItem) {
  if (item.kind === "event" && item.event.startTime) {
    return item.event.endTime ? `${item.event.startTime}–${item.event.endTime}` : item.event.startTime;
  }
  if (item.kind === "exam" && item.time) return item.time;
  return "Todo el día";
}


export function DayAgenda({
  day,
  items,
  today,
  subjects,
  goToday,
}: {
  day: string;
  items: AgendaItem[];
  today: string;
  subjects: { id: string; name: string }[];
  /** How "Ir a hoy" gets there: select in place, or navigate to the current month. Null when `day` is today. */
  goToday: { onClick: () => void } | { href: string } | null;
}) {
  const p = parts(day);
  const todayButton = "rounded-full px-3 py-[5px] text-[13px] font-medium text-accent-ink transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] active:bg-[color-mix(in_srgb,var(--color-accent)_18%,transparent)]";

  return (
    <section aria-labelledby="agenda-title" className="flex flex-col gap-[18px] lg:sticky lg:top-6">
      <div className="flex items-start justify-between gap-4">
        <h2 id="agenda-title" className="m-0 flex flex-col gap-[6px] tracking-normal">
          <span className="text-[13px] font-medium text-neutral-500">{p.weekday}</span>
          <span className="font-heading text-[56px] leading-none font-extrabold tracking-[-0.05em]">{p.day}</span>
          <span className="text-[15px] font-normal text-neutral-400">{p.month}</span>
        </h2>
        <div className="flex items-center gap-2">
          {day === today && (
            <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-[12.5px] font-semibold text-on-accent">
              Hoy
            </span>
          )}
          {goToday && "onClick" in goToday && (
            <button type="button" onClick={goToday.onClick} className={todayButton}>
              Ir a hoy
            </button>
          )}
          {goToday && "href" in goToday && (
            <Link href={goToday.href} scroll={false} className={todayButton}>
              Ir a hoy
            </Link>
          )}
          <AddToDay day={day} subjects={subjects} />
        </div>
      </div>

      {items.length === 0 ? (
        <div
          key={day}
          className="animate-fade rounded-[20px] bg-surface p-[22px] text-[15px] leading-[1.55] text-neutral-400"
        >
          Nada este día. Usa el botón + para añadir un evento, una tarea o un examen.
        </div>
      ) : (
        <ul key={day} className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li key={`${item.kind}-${item.id}`} className="animate-pop" style={{ animationDelay: `${i * 0.04}s` }}>
              <AgendaRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AgendaRow({ item }: { item: AgendaItem }) {
  const done = item.kind === "task" && item.done;
  const color = KIND_COLOR[item.kind];
  const type =
    item.kind === "exam"
      ? `Examen · ${item.subjectName}`
      : item.kind === "task"
        ? done
          ? "Tarea hecha"
          : "Tarea"
        : [item.event.calendarName ?? "Evento", item.event.location].filter(Boolean).join(" · ");

  const body = (
    <>
      <span aria-hidden className="w-1 self-stretch rounded-[2px]" style={{ background: color }} />
      <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span
          className={`truncate text-[14.5px] font-medium ${done ? "text-neutral-500 line-through decoration-neutral-600" : ""}`}
        >
          {item.title}
        </span>
        <span className="flex gap-2 text-[12px] text-neutral-500">
          <span className="tabular-nums">{timeLabel(item)}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{type}</span>
        </span>
      </span>
    </>
  );

  const rowClass =
    "group flex items-center gap-3 rounded-[14px] bg-surface px-4 py-[14px] transition-[background] duration-200";

  if (item.kind === "task") {
    return (
      <Link href="/tareas?estado=todas" className={`pressable ${rowClass}`}>
        {body}
      </Link>
    );
  }
  if (item.kind === "exam") {
    return (
      <Link href={`/universidad/${item.subjectId}`} className={`pressable ${rowClass}`}>
        {body}
      </Link>
    );
  }

  // From another Google calendar (e.g. the UJI timetable): shown, never edited here.
  if (item.event.calendarName) return <div className={rowClass}>{body}</div>;

  return (
    <div className={rowClass}>
      {body}
      <div className="flex opacity-100 transition-opacity duration-150 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        <ActionDialog
          title="Editar evento"
          action={updateEvent}
          submitLabel="Guardar cambios"
          pendingLabel="Guardando…"
          trigger={(open) => (
            <button type="button" onClick={open} aria-label={`Editar "${item.title}"`} className={iconButtonClass}>
              <PencilSimple size={16} />
            </button>
          )}
        >
          <input type="hidden" name="id" value={item.id} />
          <EventFields idPrefix={`event-${item.id}`} event={item.event} defaultDate={item.date} />
        </ActionDialog>
        <ActionDialog
          title="¿Borrar este evento?"
          action={deleteEvent}
          submitLabel="Borrar evento"
          pendingLabel="Borrando…"
          danger
          trigger={(open) => (
            <button type="button" onClick={open} aria-label={`Borrar "${item.title}"`} className={iconButtonClass}>
              <Trash size={16} />
            </button>
          )}
        >
          <input type="hidden" name="id" value={item.id} />
          <p className="text-[14px] text-neutral-300">Vas a borrar «{item.title}». No se puede deshacer.</p>
        </ActionDialog>
      </div>
    </div>
  );
}
