"use client";

import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, CheckSquare, GraduationCap, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { deleteEvent, updateEvent } from "@/app/(app)/calendario/actions";
import { ActionDialog } from "@/components/ui/action-dialog";
import { iconButtonClass } from "@/components/ui/form";
import { formatDay } from "@/lib/calendar/grid";
import type { AgendaItem } from "@/lib/calendar/types";
import { AddToDay } from "./add-to-day";
import { EventFields } from "./event-fields";

const KIND_ICON = { event: CalendarClock, task: CheckSquare, exam: GraduationCap } as const;

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
}: {
  day: string;
  items: AgendaItem[];
  today: string;
  subjects: { id: string; name: string }[];
}) {
  return (
    <section aria-labelledby="agenda-title" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <h2 id="agenda-title" className="text-lead font-medium">
            {formatDay(day)}
          </h2>
          {day === today && <span className="text-sm font-medium text-accent">Hoy</span>}
        </div>
        <AddToDay day={day} subjects={subjects} />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={day}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
        >
          {items.length === 0 ? (
            <p className="rounded-atlas bg-line/15 px-5 py-6 text-base text-muted">
              Nada este día. Usa el botón + para añadir un evento, una tarea o un examen.
            </p>
          ) : (
            <ul className="flex flex-col">
              {items.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <AgendaRow item={item} />
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function AgendaRow({ item }: { item: AgendaItem }) {
  const Icon = KIND_ICON[item.kind];
  const done = item.kind === "task" && item.done;

  const body = (
    <>
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
          item.kind === "exam" ? "bg-accent text-white" : "bg-line/25 text-accent"
        }`}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`truncate text-base ${done ? "text-muted line-through" : "text-ink"}`}>{item.title}</span>
        <span className="flex flex-wrap gap-x-3 text-xs text-muted">
          <span className="tabular-nums">{timeLabel(item)}</span>
          {item.kind === "exam" && <span>Examen de {item.subjectName}</span>}
          {item.kind === "task" && <span>{done ? "Tarea hecha" : "Fecha límite de tarea"}</span>}
          {item.kind === "event" && item.event.location && <span>{item.event.location}</span>}
        </span>
      </span>
    </>
  );

  if (item.kind === "task") {
    return (
      <Link href="/tareas?estado=todas" className="pressable flex items-center gap-3 rounded-atlas px-3 py-3 hover:bg-line/15">
        {body}
      </Link>
    );
  }
  if (item.kind === "exam") {
    return (
      <Link
        href={`/universidad/${item.subjectId}`}
        className="pressable flex items-center gap-3 rounded-atlas px-3 py-3 hover:bg-line/15"
      >
        {body}
      </Link>
    );
  }

  return (
    <div className="group flex items-center gap-3 rounded-atlas px-3 py-3 hover:bg-line/15">
      {body}
      <div className="flex opacity-100 transition-opacity duration-150 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        <ActionDialog
          title="Editar evento"
          action={updateEvent}
          submitLabel="Guardar cambios"
          pendingLabel="Guardando…"
          trigger={(open) => (
            <button type="button" onClick={open} aria-label={`Editar "${item.title}"`} className={iconButtonClass}>
              <Pencil aria-hidden className="size-4" />
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
              <Trash2 aria-hidden className="size-4" />
            </button>
          )}
        >
          <input type="hidden" name="id" value={item.id} />
          <p className="text-base">Vas a borrar «{item.title}». No se puede deshacer.</p>
        </ActionDialog>
      </div>
    </div>
  );
}
