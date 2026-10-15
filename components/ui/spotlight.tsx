"use client";

import Link from "next/link";

/** Publishes the pointer position as --mx/--my so a radial-gradient background can follow it. */
export function trackPointer(e: React.MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

type Props = { className?: string; style?: React.CSSProperties; children: React.ReactNode };

/** A card (or a link, with `href`) whose background glow follows the mouse. */
export function Spotlight({ href, ...props }: Props & { href?: string }) {
  if (href) return <Link href={href} onMouseMove={trackPointer} {...props} />;
  return <div onMouseMove={trackPointer} {...props} />;
}
