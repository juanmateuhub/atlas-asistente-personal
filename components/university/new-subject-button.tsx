"use client";

import { Plus } from "lucide-react";
import { createSubject } from "@/app/(app)/universidad/actions";
import { ActionDialog } from "@/components/ui/action-dialog";
import { primaryButtonClass } from "@/components/ui/form";
import { SubjectFields } from "./fields";

export function NewSubjectButton() {
  return (
    <ActionDialog
      title="Nueva asignatura"
      action={createSubject}
      submitLabel="Crear asignatura"
      pendingLabel="Creando…"
      trigger={(open) => (
        <button type="button" onClick={open} className={`${primaryButtonClass} inline-flex items-center gap-2`}>
          <Plus aria-hidden className="size-5" />
          Nueva asignatura
        </button>
      )}
    >
      <SubjectFields idPrefix="new-subject" />
    </ActionDialog>
  );
}
