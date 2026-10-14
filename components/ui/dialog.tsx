"use client";

import { X } from "lucide-react";
import { useId, useRef } from "react";
import { iconButtonClass } from "./form";

/**
 * Native <dialog> (modal, focus trap and Esc for free); open/close transitions
 * live in globals.css. `alert` switches the role to alertdialog for destructive
 * confirmations, as the design skill requires.
 */
export function useDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  return {
    ref,
    open: () => ref.current?.showModal(),
    close: () => ref.current?.close(),
  };
}

export function Dialog({
  dialogRef,
  title,
  alert = false,
  onClose,
  children,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  title: string;
  alert?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  return (
    <dialog
      ref={dialogRef}
      role={alert ? "alertdialog" : "dialog"}
      aria-labelledby={titleId}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto w-[calc(100%-32px)] max-w-lg rounded-atlas border border-line bg-surface p-0 text-body backdrop:bg-ink/30"
    >
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lead font-medium">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className={iconButtonClass}>
            <X aria-hidden className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
