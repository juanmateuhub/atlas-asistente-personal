export const inputClass =
  "w-full rounded-atlas border border-line bg-surface px-4 py-3 text-base text-ink focus-visible:border-accent";

export const primaryButtonClass =
  "rounded-atlas bg-accent px-6 py-3 text-base font-medium text-white hover:bg-raised";

export const secondaryButtonClass =
  "rounded-atlas border border-line px-6 py-3 text-base font-medium text-ink hover:bg-raised hover:text-white";

export const dangerButtonClass =
  "rounded-atlas bg-red-700 px-6 py-3 text-base font-medium text-white hover:bg-red-800";

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
    <p role="alert" className="text-sm text-red-700">
      {message}
    </p>
  );
}
