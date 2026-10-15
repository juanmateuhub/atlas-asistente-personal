"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AtlasLogo } from "@/components/brand/atlas-logo";
import { isActive, navItems } from "./nav-items";

type Props = { footer?: React.ReactNode; pendingCount?: number };

/** Desktop sidebar (Nocturne). Hidden below md, where TabBar takes over. */
export function Sidebar(props: Props) {
  return <SidebarFrame pathname={usePathname()} {...props} />;
}

/**
 * Pathname-free render, used as the Suspense fallback: reading the URL in a
 * dynamic route must not block the static shell.
 */
export function SidebarFrame({ pathname, footer, pendingCount = 0 }: Props & { pathname: string | null }) {
  return (
    <>
      {/* Takes the sidebar's width in the page flow; the sidebar itself is fixed to the viewport. */}
      <div aria-hidden className="hidden w-[248px] flex-none md:block" />
      <aside
        className="fixed inset-y-0 left-0 z-[2] hidden h-dvh w-[248px] flex-col overflow-y-auto px-[14px] pt-[28px] pb-[20px] md:flex"
        style={{ background: "var(--color-sidebar)" }}
      >
        <Link href="/" className="flex items-center gap-[11px] px-[10px] pb-[32px]">
          <AtlasLogo className="size-8" />
          <span className="text-[19px] font-medium tracking-[-0.025em]">Atlas</span>
        </Link>
        <nav aria-label="Principal" className="flex flex-col gap-[2px]">
          {navItems.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname !== null && isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex h-10 items-center gap-3 rounded-full px-3 text-[14px] font-medium transition-[background,color,scale] duration-[250ms,250ms,150ms] hover:bg-[color-mix(in_srgb,var(--color-text)_6%,transparent)] active:scale-[0.97]"
                style={{
                  background: active ? "var(--color-text)" : undefined,
                  color: active ? "var(--color-bg)" : "var(--color-neutral-400)",
                }}
              >
                <Icon
                  size={18}
                  weight={active ? "fill" : "regular"}
                  className="transition-colors duration-[250ms]"
                  color={active ? "var(--color-accent)" : "var(--color-neutral-500)"}
                />
                <span className="flex-1">{label}</span>
                {badge && pendingCount > 0 && (
                  <span
                    className="grid h-5 min-w-5 place-items-center rounded-full px-[6px] text-[11px] font-semibold tabular-nums"
                    style={{ background: "var(--color-accent)", color: "var(--color-on-accent)" }}
                  >
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        {footer && <div className="mt-auto">{footer}</div>}
      </aside>
    </>
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
      className="fixed inset-x-0 bottom-0 z-10 pb-[env(safe-area-inset-bottom)] md:hidden"
      style={{ background: "var(--color-sidebar)" }}
    >
      <ul className="flex">
        {navItems.filter((item) => !item.desktopOnly).map(({ href, label, short, icon: Icon }) => {
          const active = pathname !== null && isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center gap-[2px] py-[6px] text-[11px] font-medium transition-[scale] duration-150 active:scale-[0.94]"
                style={{ color: active ? "var(--color-text)" : "var(--color-neutral-500)" }}
              >
                {/* Active: ink icon on a yellow pill (yellow alone is unreadable on the light bar). */}
                <span
                  className="grid h-7 w-12 place-items-center rounded-full transition-[background] duration-200"
                  style={{ background: active ? "var(--color-accent)" : "transparent" }}
                >
                  <Icon size={21} weight={active ? "fill" : "regular"} color={active ? "var(--color-on-accent)" : undefined} />
                </span>
                {short ?? label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
