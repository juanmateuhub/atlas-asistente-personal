"use client";

import { Brain, X } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { deleteMemory, listMemories, type Memory } from "@/app/(app)/jax/actions";
import { Dialog, useDialog } from "@/components/ui/dialog";
import { iconButtonClass } from "@/components/ui/form";

/** What Jax remembers about the user (long-term memory), loaded when opened; each fact can be forgotten. */
export function MemoryDialog() {
  const dialog = useDialog();
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function open() {
    dialog.open();
    startTransition(async () => setMemories(await listMemories()));
  }

  function forget(m: Memory) {
    setMemories((list) => list?.filter((x) => x.id !== m.id) ?? null);
    startTransition(async () => {
      const r = await deleteMemory(m.id);
      if (r.error) {
        setError(r.error);
        setMemories(await listMemories());
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex flex-none items-center gap-[6px] rounded-full px-3 py-[5px] text-[12.5px] font-medium whitespace-nowrap text-neutral-400 transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] hover:text-neutral-200"
      >
        <Brain size={14} />
        Memoria
      </button>
      <Dialog
        dialogRef={dialog.ref}
        title="Lo que Jax recuerda"
        subtitle="Lo usa en todas las conversaciones. Se guarda cuando le cuentas algo de ti."
        onClose={dialog.close}
      >
        {memories === null ? (
          <div aria-hidden className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-skeleton rounded-[12px] bg-step" />
            ))}
          </div>
        ) : memories.length === 0 ? (
          <p className="m-0 text-[14.5px] leading-[1.5] text-neutral-400">
            Todavía nada. Prueba a decirle «me llamo…», «estudio Ingeniería Informática» o «prefiero estudiar por las mañanas».
          </p>
        ) : (
          <ul className="flex max-h-[50dvh] flex-col gap-2 overflow-y-auto">
            {memories.map((m) => (
              <li key={m.id} className="flex items-start gap-2 rounded-[12px] bg-step py-2 pr-1 pl-3 text-[14px] leading-[1.45]">
                <span className="min-w-0 flex-1 py-[5px] [overflow-wrap:anywhere]">{m.content}</span>
                <button type="button" onClick={() => forget(m)} aria-label={`Olvidar: ${m.content}`} title="Olvidar" className={iconButtonClass}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="m-0 text-[13px] text-danger">
            {error}
          </p>
        )}
      </Dialog>
    </>
  );
}
