"use client";

import { CalendarPlus, CheckSquare } from "@phosphor-icons/react";
import { createEvent } from "@/app/(app)/calendario/actions";
import { createTask } from "@/app/(app)/tareas/actions";
import { EventFields } from "@/components/calendar/event-fields";
import { TaskFields } from "@/components/tasks/task-fields";
import { ActionDialog } from "@/components/ui/action-dialog";
import { secondaryButtonClass } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { TITLE_MAX as EVENT_TITLE_MAX } from "@/lib/calendar/validation";
import { NOTES_MAX, TITLE_MAX } from "@/lib/tasks/validation";

/** "Crear tarea" / "Crear evento" from a message, prefilled with its subject and a link back to Gmail. */
export function MailToItem({ subject, from, link, today }: { subject: string; from: string; link: string; today: string }) {
  const toast = useToast();
  const notes = `Correo de ${from}: «${subject}»\n${link}`.slice(0, NOTES_MAX);

  return (
    <div className="flex flex-wrap gap-2">
      <ActionDialog
        title="Nueva tarea desde el correo"
        action={async (prev, fd) => {
          const r = await createTask(prev, fd);
          if (r.ok) toast("Tarea creada");
          return r;
        }}
        submitLabel="Crear tarea"
        pendingLabel="Creando…"
        trigger={(open) => (
          <button type="button" onClick={open} className={secondaryButtonClass}>
            <CheckSquare size={16} />
            Crear tarea
          </button>
        )}
      >
        <TaskFields idPrefix="mail-task" task={{ title: subject.slice(0, TITLE_MAX), notes }} withNotes />
      </ActionDialog>
      <ActionDialog
        title="Nuevo evento desde el correo"
        action={async (prev, fd) => {
          const r = await createEvent(prev, fd);
          if (r.ok) toast("Evento añadido");
          return r;
        }}
        submitLabel="Añadir evento"
        pendingLabel="Añadiendo…"
        trigger={(open) => (
          <button type="button" onClick={open} className={secondaryButtonClass}>
            <CalendarPlus size={16} />
            Crear evento
          </button>
        )}
      >
        <EventFields
          idPrefix="mail-event"
          defaultDate={today}
          event={{
            id: "",
            title: subject.slice(0, EVENT_TITLE_MAX),
            date: today,
            startTime: null,
            endTime: null,
            location: null,
            notes,
          }}
        />
      </ActionDialog>
    </div>
  );
}
