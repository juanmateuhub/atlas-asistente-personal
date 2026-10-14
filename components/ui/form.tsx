export const inputClass =
  "w-full rounded-atlas border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-muted focus-visible:border-accent";

export const primaryButtonClass =
  "pressable rounded-atlas bg-accent px-6 py-3 text-base font-medium text-white hover:bg-raised";

export const secondaryButtonClass =
  "pressable rounded-atlas border border-line px-6 py-3 text-base font-medium text-ink hover:bg-line/30";

export const dangerButtonClass =
  "pressable rounded-atlas bg-red-700 px-6 py-3 text-base font-medium text-white hover:bg-red-800";

export const iconButtonClass =
  "pressable flex size-10 shrink-0 items-center justify-center rounded-atlas text-muted hover:bg-line/30 hover:text-ink";

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
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="animate-enter text-sm text-red-700">
      {message}
    </p>
  );
}
