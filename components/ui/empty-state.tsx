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
    <section className="flex flex-col items-center gap-3 rounded-atlas border border-line px-6 py-12 text-center">
      <Icon aria-hidden className="size-8 text-accent" />
      <h2 className="text-lead font-medium">{title}</h2>
      <p className="max-w-md text-base text-muted">{description}</p>
    </section>
  );
}
