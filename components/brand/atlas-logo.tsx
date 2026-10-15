/**
 * Atlas logo ("Señal"): a heavy "A" in paper white on a near-black tile, with a
 * signal-yellow globe resting on its apex: Atlas holding up the world. Flat, no
 * gradients. Same artwork as app/icon.svg and the PNG icons in public/icons.
 */
export function AtlasLogo({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <rect width="100" height="100" rx="26" fill="#0e0e0e" />
      <path
        d="M27 80 50 40 73 80M35.5 66h29"
        fill="none"
        stroke="#f4f4f2"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="25" r="11" fill="#ffd000" />
    </svg>
  );
}
