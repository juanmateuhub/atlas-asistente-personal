"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui/form";
import type { CalendarEvent } from "@/lib/calendar/types";
import { LOCATION_MAX, NOTES_MAX, TITLE_MAX } from "@/lib/calendar/validation";

export function EventFields({
  idPrefix,
  event,
  defaultDate,
}: {
  idPrefix: string;
  event?: CalendarEvent;
  defaultDate: string;
}) {
  const [allDay, setAllDay] = useState(event ? event.startTime === null : false);
  const id = (n: string) => `${idPrefix}-${n}`;

  return (
    <>
      <Field label="Título" htmlFor={id("title")}>
        <input
          id={id("title")}
          name="title"
          required
          maxLength={TITLE_MAX}
          defaultValue={event?.title}
          placeholder="Ej. Tutoría con la profesora"
          className={inputClass}
        />
      </Field>
      <Field label="Fecha" htmlFor={id("date")}>
        <input
          id={id("date")}
          name="date"
          type="date"
          required
          defaultValue={event?.date ?? defaultDate}
          className={inputClass}
        />
      </Field>
      <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-ink">
        <input
          type="checkbox"
          name="allDay"
          checked={allDay}
          onChange={(e) => setAllDay(e.currentTarget.checked)}
          className="size-5 accent-accent"
        />
        Todo el día
      </label>
      {!allDay && (
        <div className="grid animate-enter grid-cols-2 gap-4">
          <Field label="Empieza" htmlFor={id("start")}>
            <input
              id={id("start")}
              name="startTime"
              type="time"
              required
              defaultValue={event?.startTime ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Termina" htmlFor={id("end")} hint="Opcional">
            <input id={id("end")} name="endTime" type="time" defaultValue={event?.endTime ?? ""} className={inputClass} />
          </Field>
        </div>
      )}
      <Field label="Lugar" htmlFor={id("location")} hint="Opcional">
        <input
          id={id("location")}
          name="location"
          maxLength={LOCATION_MAX}
          defaultValue={event?.location ?? ""}
          className={inputClass}
        />
      </Field>
      <Field label="Notas" htmlFor={id("notes")} hint="Opcional">
        <textarea
          id={id("notes")}
          name="notes"
          rows={3}
          maxLength={NOTES_MAX}
          defaultValue={event?.notes ?? ""}
          className={inputClass}
        />
      </Field>
    </>
  );
}
