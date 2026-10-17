import { Barbell, BookOpen, CalendarBlank, ChatsCircle, CheckSquare, EnvelopeSimple, House, type Icon } from "@phosphor-icons/react";

export type NavItem = {
  href: string;
  label: string;
  icon: Icon;
  /** Shows the pending-tasks badge. */
  badge?: boolean;
  /** Label in the mobile tab bar, where space is tight. */
  short?: string;
  /** Hidden from the mobile tab bar (reachable another way there). */
  desktopOnly?: boolean;
};

export const navItems: NavItem[] = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/tareas", label: "Tareas", icon: CheckSquare, badge: true },
  { href: "/calendario", label: "Calendario", icon: CalendarBlank },
  { href: "/universidad", label: "Universidad", short: "Uni", icon: BookOpen },
  { href: "/fitness", label: "Fitness", icon: Barbell },
  { href: "/correo", label: "Correo", icon: EnvelopeSimple },
  // Mobile: Jax lives in the top-right avatar (JaxLauncher), available on every screen.
  { href: "/jax", label: "Jax", icon: ChatsCircle, desktopOnly: true },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
