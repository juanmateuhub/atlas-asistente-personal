/** Accent glow of `size` px centred on the pointer (--mx/--my), as in the redesign's cards. */
export function spotGradient(size: number, percent: number, rest = 400) {
  return `radial-gradient(${size}px circle at var(--mx, -${rest}px) var(--my, -${rest}px), color-mix(in srgb, var(--color-accent) ${percent}%, transparent), transparent 70%)`;
}
