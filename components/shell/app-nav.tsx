"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, navItems } from "./nav-items";

/** Desktop sidebar. Hidden below md, where TabBar takes over. */
export function Sidebar({ footer }: { footer?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Principal"
      className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 border-r border-line px-4 py-8 md:flex"
    >
      <Link href="/" className="px-4 text-lead font-bold text-ink">
        Atlas
      </Link>
      <ul className="flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-atlas px-4 py-2 text-base ${
                  active ? "bg-raised text-white" : "text-body hover:bg-raised hover:text-white"
                }`}
              >
                <Icon aria-hidden className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      {footer && <div className="mt-auto px-4">{footer}</div>}
    </nav>
  );
}

/** Mobile bottom tab bar, respecting the safe-area inset. */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2 text-caption ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <Icon aria-hidden className="size-6" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
