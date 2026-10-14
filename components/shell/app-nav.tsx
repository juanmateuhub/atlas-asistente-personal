"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AtlasMark } from "./atlas-mark";
import { isActive, navItems } from "./nav-items";

/** Desktop sidebar. Hidden below md, where TabBar takes over. */
export function Sidebar({ footer }: { footer?: React.ReactNode }) {
  return <SidebarFrame pathname={usePathname()} footer={footer} />;
}

/**
 * Pathname-free render, used as the Suspense fallback: reading the URL in a
 * dynamic route must not block the static shell.
 */
export function SidebarFrame({ pathname, footer }: { pathname: string | null; footer?: React.ReactNode }) {
  return (
    <nav
      aria-label="Principal"
      className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 border-r border-line bg-line/15 px-4 py-8 md:flex"
    >
      <Link href="/" className="pressable flex items-center gap-3 self-start rounded-atlas px-4 py-1">
        <AtlasMark />
        <span className="text-lead font-bold text-ink">Atlas</span>
      </Link>
      <ul className="flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`pressable relative flex items-center gap-3 rounded-atlas px-4 py-2 text-base ${
                  active ? "text-white" : "text-body hover:bg-line/30"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    aria-hidden
                    className="absolute inset-0 rounded-atlas bg-raised"
                  />
                )}
                <Icon aria-hidden className="relative size-5" />
                <span className="relative">{label}</span>
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
  return <TabBarFrame pathname={usePathname()} />;
}

export function TabBarFrame({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
    >
      <ul className="flex">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`pressable relative flex flex-col items-center gap-1 py-2 text-caption ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="tabbar-active"
                    aria-hidden
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-accent"
                  />
                )}
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
