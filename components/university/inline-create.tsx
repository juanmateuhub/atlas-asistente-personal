"use client";

import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { FormError, inputClass } from "@/components/ui/form";

type State = { error?: string; ok?: boolean };

/**
 * "+ Add" link that expands into a one-field form. Collapses again after a
 * successful create; Esc cancels.
 */
export function InlineCreate({
  label,
  placeholder,
  action,
  hidden,
  maxLength,
}: {
  label: string;
  placeholder: string;
  action: (prev: State, fd: FormData) => Promise<State>;
  hidden: Record<string, string>;
  maxLength: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: State, fd: FormData) => {
    const result = await action(prev, fd);
    if (result.ok) setOpen(false);
    return result;
  }, {});

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.form
            key="form"
            action={formAction}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            className="flex gap-2"
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          >
            {Object.entries(hidden).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <label className="sr-only" htmlFor={`${label}-${Object.values(hidden).join("-")}`}>
              {label}
            </label>
            <input
              id={`${label}-${Object.values(hidden).join("-")}`}
              name="title"
              autoFocus
              required
              maxLength={maxLength}
              placeholder={placeholder}
              autoComplete="off"
              className={`${inputClass} py-2`}
            />
            <button
              type="submit"
              disabled={pending}
              className="pressable shrink-0 rounded-atlas bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-500"
            >
              {pending ? "Creando…" : "Crear"}
            </button>
          </motion.form>
        ) : (
          <motion.button
            key="trigger"
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            className="pressable inline-flex items-center gap-2 self-start rounded-atlas px-3 py-2 text-sm font-medium text-accent-ink hover:bg-line/20"
          >
            <Plus aria-hidden className="size-4" />
            {label}
          </motion.button>
        )}
      </AnimatePresence>
      {open && <FormError message={state.error} />}
    </div>
  );
}
