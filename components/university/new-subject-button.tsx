"use client";

import { Plus } from "@phosphor-icons/react";
import { createSubject } from "@/app/(app)/universidad/actions";
import { ActionDialog } from "@/components/ui/action-dialog";
import { SubjectFields } from "./fields";

export function NewSubjectButton() {
  return (
    <ActionDialog
      title="Nueva asignatura"
      action={createSubject}
      submitLabel="Crear asignatura"
      pendingLabel="Creando…"
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          className="inline-flex h-[42px] flex-none cursor-pointer items-center gap-[6px] rounded-full border border-accent px-5 text-[14px] font-medium whitespace-nowrap text-accent transition-[background,scale] duration-200 hover:bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] active:scale-95 active:bg-[color-mix(in_srgb,var(--color-accent)_22%,transparent)]"
          style={{
            boxShadow: "0 0 22px color-mix(in srgb, var(--color-accent) 25%, transparent)",
            transitionTimingFunction: "cubic-bezier(.34,1.8,.5,1)",
          }}
        >
          <Plus size={16} />
          Nueva asignatura
        </button>
      )}
    >
      <SubjectFields idPrefix="new-subject" />
    </ActionDialog>
  );
}
