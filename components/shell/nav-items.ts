import { BookOpen, CalendarBlank, ChatsCircle, CheckSquare, House, type Icon } from "@phosphor-icons/react";

export type NavItem = {
  href: string;
  label: string;
  icon: Icon;
  /** Shows the pending-tasks badge. */
  badge?: boolean;
};

export const navItems: NavItem[] = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/tareas", label: "Tareas", icon: CheckSquare, badge: true },
  { href: "/calendario", label: "Calendario", icon: CalendarBlank },
  { href: "/universidad", label: "Universidad", icon: BookOpen },
  { href: "/jax", label: "Jax", icon: ChatsCircle },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
