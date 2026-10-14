/** Atlas mark: a meridian globe drawn with the accent colour. */
export function AtlasMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden className={className}>
      <circle cx="14" cy="14" r="13" className="fill-accent" />
      <ellipse cx="14" cy="14" rx="5.5" ry="11" fill="none" stroke="white" strokeWidth="1.5" />
      <path d="M3.5 10.5h21M3.5 17.5h21" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}
