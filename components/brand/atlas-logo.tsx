import { useId } from "react";

/**
 * Atlas logo: an "A" ringed by an orbit — the world Atlas holds, and the "A" of
 * the name — in white on the Nocturne deep purple. The orbit passes in front of
 * the legs (masked gap) for depth. Same artwork as app/icon.svg.
 */
export function AtlasLogo({ className = "size-8" }: { className?: string }) {
  const id = useId();
  const bg = `${id}-bg`;
  const shine = `${id}-shine`;
  const cut = `${id}-cut`;
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={`shrink-0 ${className}`}>
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4180" />
          <stop offset="0.55" stopColor="#2f2a52" />
          <stop offset="1" stopColor="#1e1b33" />
        </linearGradient>
        <radialGradient id={shine} cx="0.32" cy="0.22" r="0.75">
          <stop offset="0" stopColor="#b5abfc" stopOpacity="0.35" />
          <stop offset="1" stopColor="#b5abfc" stopOpacity="0" />
        </radialGradient>
        <mask id={cut} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect width="100" height="100" fill="#fff" />
          <path
            d="M19 55 A31 8 0 0 0 81 55"
            transform="rotate(-14 50 55)"
            fill="none"
            stroke="#000"
            strokeWidth="17"
            strokeLinecap="round"
          />
        </mask>
      </defs>
      <rect width="100" height="100" rx="22.5" fill={`url(#${bg})`} />
      <rect width="100" height="100" rx="22.5" fill={`url(#${shine})`} />
      {/* Hairline edge, like the redesign's surfaces. */}
      <rect x="0.75" y="0.75" width="98.5" height="98.5" rx="21.75" fill="none" stroke="#d2cefd" strokeOpacity="0.28" strokeWidth="1.5" />
      <g fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="7.5">
        <path d="M50 18 Q38 44 29 81 M50 18 Q62 44 71 81" mask={`url(#${cut})`} />
        <path d="M19 55 A31 8 0 0 0 81 55" transform="rotate(-14 50 55)" />
      </g>
    </svg>
  );
}
