"use client";

import { useSyncExternalStore } from "react";

/** Night = before 07:00 or from 21:00 (local time), as in the redesign. */
function isNight() {
  const h = new Date().getHours();
  return h < 7 || h >= 21;
}
const subscribe = (onChange: () => void) => {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
};

/** Deterministic star field (same seed as the redesign): 46 stars, 20% of them 2px. */
const STARS = (() => {
  let s = 7;
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: 46 }, () => {
    const size = r() < 0.2 ? 2 : 1;
    return { left: r() * 100, top: r() * 100, size, duration: 3 + r() * 4, delay: r() * 4 };
  });
})();

/**
 * Ambient light behind every screen: two soft glows and, at night, a sky of
 * twinkling stars that fades out downwards.
 */
export function Ambient() {
  const night = useSyncExternalStore(subscribe, isNight, () => false);

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-360px] left-[160px] h-[700px] w-[1000px] rounded-full"
        style={{
          background: "radial-gradient(closest-side, color-mix(in srgb, var(--color-accent) 17%, transparent), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-240px] bottom-[-420px] h-[760px] w-[900px] rounded-full"
        style={{
          background: "radial-gradient(closest-side, color-mix(in srgb, var(--color-section-glow) 34%, transparent), transparent)",
        }}
      />
      {night && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 right-0 left-0 h-[360px] md:left-[248px]"
          style={{
            maskImage: "linear-gradient(to bottom, black, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
          }}
        >
          {STARS.map((star, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-accent-100"
              style={{
                left: `${star.left}%`,
                top: `${star.top}%`,
                width: star.size,
                height: star.size,
                opacity: 0.2,
                animation: `atlasTwinkle ${star.duration}s ${star.delay}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
