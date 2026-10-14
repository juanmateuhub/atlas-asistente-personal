"use client";

import { MotionConfig } from "motion/react";

/** App-wide motion defaults: short ease-out, and no motion when the OS asks for less. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </MotionConfig>
  );
}
