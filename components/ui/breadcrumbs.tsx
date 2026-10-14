import { ChevronRight } from "lucide-react";
import Link from "next/link";

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Ruta">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight aria-hidden className="size-4 shrink-0" />}
            {item.href ? (
              <Link href={item.href} className="truncate rounded-atlas px-1 hover:text-accent">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate px-1 text-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
