import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-atlas bg-line/15 px-6 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-surface">
        <Icon aria-hidden className="size-7 text-accent" />
      </span>
      <h2 className="text-lead font-medium">{title}</h2>
      <p className="max-w-md text-base text-muted">{description}</p>
    </section>
  );
}
