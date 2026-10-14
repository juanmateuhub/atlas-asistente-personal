"use client";

import { CheckCircle } from "@phosphor-icons/react";
import { createContext, use, useCallback, useRef, useState } from "react";

type Toast = { id: number; text: string; onUndo?: () => void };
type ShowToast = (text: string, onUndo?: () => void) => void;

const ToastContext = createContext<ShowToast | null>(null);

/** Floating confirmation pill at the bottom centre, with an optional "Deshacer". 4 s, like the redesign. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);

  const show = useCallback<ShowToast>((text, onUndo) => {
    clearTimeout(timer.current);
    setToast({ id: ++seq.current, text, onUndo });
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const visible = toast !== null;

  return (
    <ToastContext value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-[calc(28px+env(safe-area-inset-bottom))] left-1/2 z-[60] flex items-center gap-[14px] rounded-full py-2 pr-2 pl-4 text-[13.5px] max-md:bottom-[calc(84px+env(safe-area-inset-bottom))]"
        style={{
          background: "color-mix(in srgb, var(--color-surface) 82%, transparent)",
          backdropFilter: "blur(24px)",
          boxShadow:
            "0 0 0 1px color-mix(in srgb, var(--color-text) 10%, transparent), 0 0 30px color-mix(in srgb, var(--color-accent) 18%, transparent), 0 18px 40px rgba(0,0,0,.5)",
          transition: "transform .5s cubic-bezier(.34,1.5,.5,1), opacity .3s",
          transform: visible ? "translate(-50%, 0)" : "translate(-50%, 28px) scale(.94)",
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
        }}
      >
        <CheckCircle size={19} weight="fill" color="var(--color-accent)" />
        <span className="max-w-[60vw] truncate text-neutral-200">{toast?.text}</span>
        {toast?.onUndo ? (
          <button
            type="button"
            onClick={() => {
              toast.onUndo?.();
              clearTimeout(timer.current);
              setToast(null);
            }}
            className="rounded-full px-3 py-1.5 text-[14px] font-medium text-accent transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] active:bg-[color-mix(in_srgb,var(--color-accent)_18%,transparent)]"
          >
            Deshacer
          </button>
        ) : (
          <span className="w-1" />
        )}
      </div>
    </ToastContext>
  );
}

export function useToast(): ShowToast {
  const show = use(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>");
  return show;
}
