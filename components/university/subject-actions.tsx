"use client";

import { Pencil, Trash2 } from "lucide-react";
import { deleteSubject, updateSubject } from "@/app/(app)/universidad/actions";
import { ActionDialog } from "@/components/ui/action-dialog";
import { secondaryButtonClass } from "@/components/ui/form";
import type { Subject } from "@/lib/university/types";
import { SubjectFields } from "./fields";

export function SubjectActions({ subject }: { subject: Subject }) {
  return (
    <div className="flex gap-2">
      <ActionDialog
        title="Editar asignatura"
        action={updateSubject}
        submitLabel="Guardar cambios"
        pendingLabel="Guardando…"
        trigger={(open) => (
          <button type="button" onClick={open} className={`${secondaryButtonClass} inline-flex items-center gap-2 py-2`}>
            <Pencil aria-hidden className="size-4" />
            Editar
          </button>
        )}
      >
        <input type="hidden" name="id" value={subject.id} />
        <SubjectFields idPrefix="edit-subject" subject={subject} />
      </ActionDialog>
      <ActionDialog
        title="¿Borrar esta asignatura?"
        action={deleteSubject}
        submitLabel="Borrar asignatura"
        pendingLabel="Borrando…"
        danger
        trigger={(open) => (
          <button
            type="button"
            onClick={open}
            aria-label="Borrar asignatura"
            className={`${secondaryButtonClass} inline-flex items-center py-2`}
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        )}
      >
        <input type="hidden" name="id" value={subject.id} />
        <p className="text-base">
          Vas a borrar «{subject.name}» con todos sus temas, apuntes y exámenes. No se puede deshacer.
        </p>
      </ActionDialog>
    </div>
  );
}
