"use client";

import { useActionState } from "react";
import { Dialog, useDialog } from "./dialog";
import { FormError, dangerButtonClass, primaryButtonClass, secondaryButtonClass } from "./form";

type State = { error?: string; ok?: boolean };

/**
 * A trigger + modal form bound to a server action. The dialog closes once the
 * action reports `ok`; errors are shown next to the buttons.
 */
export function ActionDialog({
  trigger,
  title,
  action,
  submitLabel,
  pendingLabel,
  danger = false,
  children,
}: {
  trigger: (open: () => void) => React.ReactNode;
  title: string;
  action: (prev: State, fd: FormData) => Promise<State>;
  submitLabel: string;
  pendingLabel: string;
  /** Destructive confirmation: alertdialog role and red button. */
  danger?: boolean;
  children: React.ReactNode;
}) {
  const dialog = useDialog();
  const [state, formAction, pending] = useActionState(async (prev: State, fd: FormData) => {
    const result = await action(prev, fd);
    if (result.ok) dialog.close();
    return result;
  }, {});

  return (
    <>
      {trigger(dialog.open)}
      <Dialog dialogRef={dialog.ref} title={title} alert={danger} onClose={dialog.close}>
        <form action={formAction} className="flex flex-col gap-4">
          {children}
          <FormError message={state.error} />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={dialog.close} className={secondaryButtonClass}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className={danger ? dangerButtonClass : primaryButtonClass}
            >
              {pending ? pendingLabel : submitLabel}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
