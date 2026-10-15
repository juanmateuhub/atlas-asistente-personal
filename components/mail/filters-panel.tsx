"use client";

import { Funnel, Plus, X } from "@phosphor-icons/react";
import { useActionState, useId, useRef } from "react";
import { addMailFilter, deleteMailFilter } from "@/app/(app)/correo/actions";
import { FormError, inputClass } from "@/components/ui/form";
import { FIELD_LABEL, FILTER_FIELDS, PATTERN_MAX, type MailFilter } from "@/lib/mail/filters";

/** Junk rules: messages whose subject/sender contains the text are hidden in Atlas (not deleted). */
export function FiltersPanel({
  filters,
  hiddenCount,
  bare = false,
}: {
  filters: MailFilter[];
  hiddenCount: number;
  /** Inside a dialog: no card and no heading (the dialog provides both). */
  bare?: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const idp = useId();
  const [state, action, pending] = useActionState(async (prev: { error?: string; ok?: boolean }, fd: FormData) => {
    const result = await addMailFilter(prev, fd);
    if (result.ok) form.current?.reset();
    return result;
  }, {});

  return (
    <section
      aria-labelledby={bare ? undefined : "filters-title"}
      className={`flex flex-col gap-4 ${bare ? "" : "rounded-[20px] p-[22px]"}`}
      style={
        bare
          ? undefined
          : {
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 92%, transparent), color-mix(in srgb, var(--color-surface) 55%, transparent))",
              boxShadow:
                "inset 0 1px 0 color-mix(in srgb, var(--color-text) 8%, transparent), 0 0 0 1px color-mix(in srgb, var(--color-text) 5%, transparent), 0 24px 60px rgba(0,0,0,.38)",
            }
      }
    >
      <div className={bare ? "hidden" : "flex items-center gap-3"}>
        <Funnel size={18} weight="fill" color="var(--color-accent-300)" />
        <h2 id="filters-title" className="m-0 flex-1 text-[17px] tracking-[-0.01em]">
          Filtros de basura
        </h2>
        <span className="text-[12.5px] text-neutral-500 tabular-nums">
          {hiddenCount === 1 ? "1 oculto" : `${hiddenCount} ocultos`}
        </span>
      </div>
      <p className="m-0 text-[13px] leading-[1.5] text-neutral-400">
        Se ocultan en Atlas los correos que contengan estos textos. En Gmail siguen intactos.
      </p>

      <ul className="flex flex-col gap-[6px]">
        {filters.map((f) => (
          <li
            key={f.id}
            className="flex items-center gap-3 rounded-[12px] py-2 pr-1 pl-3"
            style={{ background: "color-mix(in srgb, var(--color-text) 4%, transparent)" }}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[14px] font-medium">{f.pattern}</span>
              <span className="text-[11.5px] text-neutral-500">{FIELD_LABEL[f.field]}</span>
            </span>
            <form action={deleteMailFilter}>
              <input type="hidden" name="id" value={f.id} />
              <button
                type="submit"
                aria-label={`Quitar el filtro «${f.pattern}»`}
                className="pressable grid size-[30px] place-items-center rounded-full text-neutral-500 transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] hover:text-neutral-300"
              >
                <X size={14} />
              </button>
            </form>
          </li>
        ))}
        {filters.length === 0 && <li className="text-[13px] text-neutral-500">Sin filtros: ves toda la bandeja.</li>}
      </ul>

      <form ref={form} action={action} className="flex flex-col gap-2">
        <label htmlFor={`${idp}-pattern`} className="sr-only">
          Texto a filtrar
        </label>
        <input
          id={`${idp}-pattern`}
          name="pattern"
          required
          maxLength={PATTERN_MAX}
          placeholder="Texto a ocultar, p. ej. Newsletter"
          autoComplete="off"
          className={inputClass}
        />
        <div className="flex gap-2">
          <label htmlFor={`${idp}-field`} className="sr-only">
            Dónde buscar
          </label>
          <select id={`${idp}-field`} name="field" defaultValue="subject" className={`${inputClass} flex-1`}>
            {FILTER_FIELDS.map((f) => (
              <option key={f} value={f}>
                {FIELD_LABEL[f]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            aria-label="Añadir filtro"
            className="pressable grid size-11 flex-none place-items-center rounded-full border border-accent text-accent-200"
            style={{ background: "color-mix(in srgb, var(--color-accent) 14%, transparent)" }}
          >
            <Plus size={18} />
          </button>
        </div>
        <FormError message={state.error} />
      </form>
    </section>
  );
}
