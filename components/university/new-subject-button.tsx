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
          className="pressable inline-flex h-[44px] flex-none cursor-pointer items-center gap-[6px] rounded-full bg-accent px-5 text-[15px] font-semibold whitespace-nowrap text-on-accent transition-[background,scale] hover:bg-accent-500"
        >
          <Plus size={16} weight="bold" />
          Nueva asignatura
        </button>
      )}
    >
      <SubjectFields idPrefix="new-subject" />
    </ActionDialog>
  );
}
