"use client";

import { Funnel } from "@phosphor-icons/react";
import { Dialog, useDialog } from "@/components/ui/dialog";
import type { MailFilter } from "@/lib/mail/filters";
import { DisconnectButton } from "./disconnect-button";
import { FiltersPanel } from "./filters-panel";

/** Phones: the filters panel would sit below the whole inbox, so it opens from a button instead. */
export function FiltersSheet({ filters, hiddenCount, email }: { filters: MailFilter[]; hiddenCount: number; email: string }) {
  const dialog = useDialog();
  return (
    <>
      <button
        type="button"
        onClick={dialog.open}
        className="inline-flex items-center gap-[6px] rounded-full px-3 py-[5px] text-[13px] font-medium text-accent-ink transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] lg:hidden"
      >
        <Funnel size={15} />
        Filtros
      </button>
      <Dialog
        dialogRef={dialog.ref}
        title="Filtros de basura"
        subtitle={hiddenCount === 1 ? "1 correo oculto" : `${hiddenCount} correos ocultos`}
        onClose={dialog.close}
      >
        <FiltersPanel filters={filters} hiddenCount={hiddenCount} bare />
        <div className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-neutral-500">
          <span className="truncate">{email}</span>
          <span aria-hidden>·</span>
          <DisconnectButton email={email} />
        </div>
      </Dialog>
    </>
  );
}
