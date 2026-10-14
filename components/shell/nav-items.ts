import { BookOpen, CalendarDays, CheckSquare, Home, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/tareas", label: "Tareas", icon: CheckSquare },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/universidad", label: "Universidad", icon: BookOpen },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
