/* Nocturne form + button styles (from the redesign's .input / .btn classes). */

export const inputClass =
  "w-full min-h-[44px] rounded-[12px] border border-divider bg-surface px-[14px] text-[15px] text-text caret-accent transition-colors hover:border-[color-mix(in_srgb,var(--color-text)_45%,transparent)] focus-visible:border-accent focus-visible:outline-offset-0 [&:is(textarea)]:py-3";

/** Primary action: accent outline, never a fill. */
export const primaryButtonClass =
  "pressable inline-flex h-[38px] items-center justify-center gap-[6px] rounded-full border border-accent px-[18px] text-[14px] font-medium text-accent transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] active:bg-[color-mix(in_srgb,var(--color-accent)_22%,transparent)]";

export const secondaryButtonClass =
  "pressable inline-flex h-[38px] items-center justify-center gap-[6px] rounded-full border border-divider px-4 text-[14px] font-medium text-text transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] active:bg-[color-mix(in_srgb,var(--color-text)_14%,transparent)]";

export const dangerButtonClass =
  "pressable inline-flex h-[38px] items-center justify-center gap-[6px] rounded-full border border-[#e27d8e] px-[18px] text-[14px] font-medium text-[#f0a3b0] transition-colors hover:bg-[color-mix(in_srgb,#e27d8e_14%,transparent)] active:bg-[color-mix(in_srgb,#e27d8e_24%,transparent)]";

export const iconButtonClass =
  "pressable grid size-[30px] shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] hover:text-neutral-300";

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
      <label htmlFor={htmlFor} className="text-[12px] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
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
    <p role="alert" className="animate-fade text-[13px] text-[#f0a3b0]">
      {message}
    </p>
  );
}
