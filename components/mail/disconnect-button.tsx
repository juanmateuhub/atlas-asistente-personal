"use client";

import { disconnectMail } from "@/app/(app)/correo/actions";
import { ActionDialog } from "@/components/ui/action-dialog";

export function DisconnectButton({ email }: { email: string }) {
  return (
    <ActionDialog
      title="¿Desconectar el correo?"
      action={disconnectMail}
      submitLabel="Desconectar"
      pendingLabel="Desconectando…"
      danger
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          className="text-[12.5px] text-neutral-500 underline-offset-2 hover:text-neutral-300 hover:underline"
        >
          Desconectar
        </button>
      )}
    >
      <p className="text-[14px] text-neutral-300">
        Atlas dejará de leer {email} y se retirará el permiso en Google. Tus filtros se guardan y tus correos no se tocan.
      </p>
    </ActionDialog>
  );
}
