"use client";

import { Alarm, BellSimple, Plus, X } from "@phosphor-icons/react";
import { useOptimistic, useTransition } from "react";
import { createReminder, deleteReminder } from "@/app/(app)/recordatorios/actions";
import { PushToggle } from "@/components/push/push-toggle";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Field, iconButtonClass, inputClass } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { REMINDER_TITLE_MAX } from "@/lib/reminders/validation";

export type ReminderView = { id: string; title: string; day: string; time: string; past: boolean };

/** Inicio card: what Jax will remind the user of, with a quick add and the device's push switch. */
export function RemindersCard({ reminders, today, nowTime }: { reminders: ReminderView[]; today: string; nowTime: string }) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [items, removeItem] = useOptimistic(reminders, (list, id: string) => list.filter((r) => r.id !== id));

  function remove(r: ReminderView) {
    startTransition(async () => {
      removeItem(r.id);
      const result = await deleteReminder(r.id);
      toast(result.error ?? `Recordatorio «${r.title}» cancelado`);
    });
  }

  return (
    <section id="recordatorios" aria-labelledby="home-reminders" className="flex scroll-mt-6 flex-col gap-3 rounded-[22px] bg-surface p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-reminders" className="m-0 text-[24px] tracking-[-0.035em]">
          Recordatorios
        </h2>
        <ActionDialog
          title="Nuevo recordatorio"
          action={async (prev, fd) => {
            const r = await createReminder(prev, fd);
            if (r.ok) toast("Te lo recordaré");
            return r;
          }}
          submitLabel="Guardar"
          pendingLabel="Guardando…"
          trigger={(open) => (
            <button type="button" onClick={open} aria-label="Nuevo recordatorio" title="Nuevo recordatorio" className={iconButtonClass}>
              <Plus size={17} />
            </button>
          )}
        >
          <Field label="Qué te recuerdo" htmlFor="reminder-title">
            <input
              id="reminder-title"
              name="title"
              required
              maxLength={REMINDER_TITLE_MAX}
              placeholder="Ej. Llamar a la secretaría"
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Día" htmlFor="reminder-date">
              <input id="reminder-date" name="date" type="date" required min={today} defaultValue={today} className={inputClass} />
            </Field>
            <Field label="Hora" htmlFor="reminder-time">
              <input id="reminder-time" name="time" type="time" required defaultValue={nextHour(nowTime)} className={inputClass} />
            </Field>
          </div>
        </ActionDialog>
      </div>

      {items.length === 0 ? (
        <p className="m-0 flex items-start gap-2 text-[15px] leading-[1.5] text-neutral-500">
          <Alarm size={18} className="mt-[2px] flex-none" />
          Nada programado. Pídele a Jax «recuérdame mañana a las 9 llevar el portátil».
        </p>
      ) : (
        <ul className="mx-[-10px] flex flex-col">
          {items.map((r) => (
            <li key={r.id} className="flex items-center gap-[14px] rounded-[14px] p-[10px]">
              <span
                aria-hidden
                className={`grid size-9 flex-none place-items-center rounded-[12px] ${r.past ? "bg-step text-neutral-500" : "bg-accent text-on-accent"}`}
              >
                <BellSimple size={17} weight={r.past ? "regular" : "fill"} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <span className={`truncate text-[15.5px] font-semibold ${r.past ? "text-neutral-500 line-through decoration-neutral-600" : ""}`}>
                  {r.title}
                </span>
                <span className="text-[12.5px] whitespace-nowrap text-neutral-500">
                  {r.day} · {r.time}
                </span>
              </span>
              {!r.past && (
                <button type="button" onClick={() => remove(r)} aria-label={`Cancelar «${r.title}»`} className={iconButtonClass}>
                  <X size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="-mx-1 -mb-1">
        <PushToggle />
      </div>
    </section>
  );
}

/** Default time in the form: the next full hour. */
function nextHour(now: string): string {
  const h = (Number(now.slice(0, 2)) + 1) % 24;
  return `${String(h).padStart(2, "0")}:00`;
}
