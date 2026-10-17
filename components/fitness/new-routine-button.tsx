"use client";

import { Plus } from "@phosphor-icons/react";
import { createRoutine } from "@/app/(app)/fitness/actions";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Field, inputClass, secondaryButtonClass } from "@/components/ui/form";

export function NewRoutineButton() {
  return (
    <ActionDialog
      title="Nueva rutina"
      action={createRoutine}
      submitLabel="Crear rutina"
      pendingLabel="Creando…"
      trigger={(open) => (
        <button type="button" onClick={open} className={`${secondaryButtonClass} h-[36px] text-[13.5px]`}>
          <Plus size={14} weight="bold" />
          Nueva
        </button>
      )}
    >
      <Field label="Nombre" htmlFor="new-routine-name" hint="Después añades los ejercicios.">
        <input id="new-routine-name" name="name" required maxLength={80} placeholder="P. ej. Torso" className={inputClass} />
      </Field>
    </ActionDialog>
  );
}
