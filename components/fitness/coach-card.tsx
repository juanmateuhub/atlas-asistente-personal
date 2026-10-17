"use client";

import { Sparkle } from "@phosphor-icons/react";
import { useActionState } from "react";
import { askCoach } from "@/app/(app)/fitness/actions";
import { JaxAvatar } from "@/components/jax/jax-avatar";
import { FormError, primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import type { CoachNote } from "@/lib/fitness/queries";
import type { FitnessFormState } from "@/lib/fitness/validation";

const when = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

/** Jax as a coach: its latest analysis of your training, and a button to ask for a new one. */
export function CoachCard({ note }: { note: CoachNote | null }) {
  const [state, action, pending] = useActionState<FitnessFormState>(() => askCoach(), {});

  return (
    <section aria-labelledby="coach-title" className="flex flex-col gap-4 rounded-[22px] bg-surface p-[18px] sm:p-[22px]">
      <div className="flex items-center gap-3">
        <JaxAvatar mood={pending ? "thinking" : "idle"} className="size-11 flex-none" />
        <div className="flex min-w-0 flex-col">
          <h2 id="coach-title" className="m-0 text-[20px] tracking-[-0.03em]">
            Jax, tu entrenador
          </h2>
          <span className="text-[12.5px] text-neutral-500">
            {note ? `Análisis del ${when.format(new Date(note.createdAt))}` : "Analiza tus entrenos y te dice qué ajustar"}
          </span>
        </div>
      </div>

      <div aria-live="polite" className="flex flex-col gap-3">
        {pending ? (
          <p className="m-0 animate-pulse text-[14.5px] text-neutral-400">Jax está revisando tus últimas semanas…</p>
        ) : note ? (
          <>
            <p className="m-0 text-[15px] leading-[1.55] text-neutral-200">{note.summary}</p>
            {note.tips.length > 0 && (
              <ul className="m-0 flex flex-col gap-2 pl-0">
                {note.tips.map((tip) => (
                  <li key={tip} className="flex gap-2 rounded-[14px] bg-step px-3 py-[10px] text-[14px] leading-[1.45]">
                    <Sparkle size={15} weight="fill" color="var(--color-accent-ink)" className="mt-[2px] flex-none" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="m-0 text-[14.5px] leading-[1.5] text-neutral-400">
            Mira tu constancia, el volumen de cada músculo y cómo progresan tus ejercicios, y te da consejos para la próxima semana. También le puedes
            preguntar en el chat.
          </p>
        )}
      </div>

      <FormError message={state.error} />
      <form action={action}>
        <button type="submit" disabled={pending} className={note ? secondaryButtonClass : primaryButtonClass}>
          <Sparkle size={15} weight="fill" />
          {pending ? "Analizando…" : note ? "Analizar de nuevo" : "Analizar mi entrenamiento"}
        </button>
      </form>
    </section>
  );
}
