"use client";

import { X } from "@phosphor-icons/react";
import { useId, useRef } from "react";
import { iconButtonClass } from "./form";

/**
 * Native <dialog> (modal, focus trap and Esc for free), flat white card that
 * floats (the one place with a shadow), 22px radius, pop-in (globals.css).
 * `alert` switches the role to alertdialog for destructive confirmations.
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
  subtitle,
  alert = false,
  onClose,
  children,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  title: string;
  subtitle?: string;
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
      className="m-auto w-[min(420px,calc(100%-32px))] rounded-[22px] border-0 p-0 text-text"
      style={{ background: "var(--color-surface)", boxShadow: "var(--shadow-lg)" }}
    >
      <div className="flex flex-col gap-[18px] p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-[22px] font-bold tracking-[-0.035em]">
              {title}
            </h2>
            {subtitle && <span className="text-[13px] text-neutral-500">{subtitle}</span>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className={iconButtonClass}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
