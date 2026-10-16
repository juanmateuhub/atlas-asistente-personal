"use client";

import { CalendarPlus, CheckSquare, EnvelopeSimple, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { acceptMailSuggestion, dismissMailSuggestion, undoMailSuggestion } from "@/app/(app)/correo/actions";
import { iconButtonClass } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export type SuggestionView = { id: string; kind: "task" | "event"; summary: string; mailSubject: string; mailFrom: string; gmailId: string };

/**
 * What Jax found on its own in the new mail. Nothing reaches Tareas or the
 * calendar until the user taps Añadir (with Deshacer in the toast).
 */
export function MailSuggestions({ suggestions }: { suggestions: SuggestionView[] }) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [items, hide] = useOptimistic(suggestions, (list, id: string) => list.filter((s) => s.id !== id));

  if (items.length === 0) return null;

  function accept(s: SuggestionView) {
    startTransition(async () => {
      hide(s.id);
      const r = await acceptMailSuggestion(s.id);
      if (r.error || !r.createdId) {
        toast(r.error ?? "No se ha podido añadir.");
        return;
      }
      const created = r.createdId;
      toast(s.kind === "task" ? "Tarea añadida" : "Evento añadido", () => {
        startTransition(async () => {
          await undoMailSuggestion(s.id, created);
        });
      });
    });
  }

  function dismiss(s: SuggestionView) {
    startTransition(async () => {
      hide(s.id);
      await dismissMailSuggestion(s.id);
    });
  }

  return (
    <section
      id="sugerencias"
      aria-labelledby="home-suggestions"
      className="col-span-full flex scroll-mt-6 flex-col gap-3 rounded-[22px] bg-surface p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="home-suggestions" className="m-0 text-[24px] tracking-[-0.035em]">
          Jax ha visto en tu correo
        </h2>
        <p className="m-0 text-[14px] text-neutral-500">Añade lo que te sirva; lo demás, descártalo.</p>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((s) => {
          const Icon = s.kind === "task" ? CheckSquare : CalendarPlus;
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-x-[14px] gap-y-2 rounded-[16px] bg-step p-3">
              <span aria-hidden className="grid size-[42px] flex-none place-items-center rounded-[12px] bg-surface">
                <Icon size={20} />
              </span>
              <span className="flex min-w-0 flex-1 basis-[200px] flex-col gap-[2px]">
                <span className="text-[15px] font-semibold [overflow-wrap:anywhere]">{s.summary}</span>
                <Link
                  href={`/correo/${s.gmailId}`}
                  className="flex min-w-0 items-center gap-[6px] text-[12.5px] text-neutral-500 hover:text-text"
                >
                  <EnvelopeSimple size={13} className="flex-none" />
                  <span className="truncate">
                    {s.mailFrom.replace(/\s*<.*>$/, "")} · {s.mailSubject}
                  </span>
                </Link>
              </span>
              <span className="ml-auto flex flex-none items-center gap-1">
                <button
                  type="button"
                  onClick={() => accept(s)}
                  className="pressable inline-flex h-9 items-center rounded-full bg-accent px-4 text-[13.5px] font-semibold text-on-accent transition-[background,scale] hover:bg-accent-500"
                >
                  {s.kind === "task" ? "Añadir a Tareas" : "Añadir al calendario"}
                </button>
                <button type="button" onClick={() => dismiss(s)} aria-label={`Descartar: ${s.summary}`} title="Descartar" className={iconButtonClass}>
                  <X size={15} />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
