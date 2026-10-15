/* "Señal" form + button styles. Buttons are fully round and flat; only the primary one uses the accent. */

export const inputClass =
  "w-full min-h-[44px] rounded-[12px] border border-divider bg-surface px-[14px] text-[15px] text-text caret-text transition-colors hover:border-[color-mix(in_srgb,var(--color-text)_35%,transparent)] focus-visible:border-text focus-visible:outline-offset-0 [&:is(textarea)]:py-3";

/** Primary action: signal-yellow fill, ink text. One per view. */
export const primaryButtonClass =
  "pressable inline-flex h-[40px] items-center justify-center gap-[6px] rounded-full bg-accent px-[18px] text-[14px] font-semibold text-on-accent transition-[background,scale] hover:bg-accent-500 active:bg-accent-600";

export const secondaryButtonClass =
  "pressable inline-flex h-[40px] items-center justify-center gap-[6px] rounded-full bg-step px-4 text-[14px] font-medium text-text transition-[background,scale] hover:bg-neutral-800 active:bg-neutral-700";

export const dangerButtonClass =
  "pressable inline-flex h-[40px] items-center justify-center gap-[6px] rounded-full bg-danger px-[18px] text-[14px] font-semibold text-white transition-[background,scale] hover:bg-[#ab1f1f] active:bg-[#951b1b]";

export const iconButtonClass =
  "pressable grid size-[32px] shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] hover:text-neutral-200";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[5px]">
      <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-neutral-400">
        {label}
      </label>
      {children}
      {hint && <p className="text-[12px] text-neutral-500">{hint}</p>}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="animate-fade text-[13px] text-danger">
      {message}
    </p>
  );
}
