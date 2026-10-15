"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import Image from "next/image";
import { useEffect, useRef } from "react";

export type JaxMood = "idle" | "thinking" | "speaking";

/**
 * Eye centres on public/jax-senal.png (transparent 512×512 cut-out), as % of the
 * image. Measured from the artwork by the cut-out script; the original is in
 * assets/jax-avatar-source.png.
 */
const EYES = [
  { x: 50.1, y: 40.2 }, // top
  { x: 38.1, y: 47.2 }, // left
  { x: 62, y: 47.2 }, // right
  { x: 50, y: 56 }, // bottom
] as const;
const EYE_LID = 4.2; // % of the image: covers a baked-in eye when blinking
// "Señal" colours: signal-yellow eyes, graphite hood (public/jax-senal.png; Nocturne original in assets/jax-nocturne.png).
const GLOW = "radial-gradient(circle, rgba(255,250,224,1) 0%, rgba(255,208,0,0.65) 30%, rgba(255,208,0,0) 70%)";
const LID = "radial-gradient(circle, #1a1918 55%, rgba(26,25,24,0) 75%)";
const SRC = "/jax-senal.png";

type Props = {
  mood?: JaxMood;
  className?: string;
  /** "full": depth, sheen, particles, pointer tracking. "lite": for small sizes. */
  detail?: "full" | "lite";
};

/**
 * Jax with depth and a bit of life. Everything animates transform/opacity only
 * (static filters/masks are not animated). Reduced motion: a still image.
 */
export function JaxAvatar({ mood = "idle", className = "size-8", detail = "lite" }: Props) {
  const reduce = useReducedMotion();
  const full = detail === "full";
  const root = useRef<HTMLSpanElement>(null);

  // Pointer tracking (full detail only): head turns and eyes look toward the cursor.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 80, damping: 14 });
  const sy = useSpring(py, { stiffness: 80, damping: 14 });
  const rotateY = useTransform(sx, [-1, 1], [-14, 14]);
  const rotateX = useTransform(sy, [-1, 1], [10, -10]);
  // Small: the baked-in eyes stay put, so the glow may only drift slightly.
  const lookX = useTransform(sx, [-1, 1], ["-12%", "12%"]);
  const lookY = useTransform(sy, [-1, 1], ["-8%", "8%"]);

  useEffect(() => {
    if (!full || reduce) return;
    const onMove = (e: PointerEvent) => {
      const r = root.current?.getBoundingClientRect();
      if (!r) return;
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      px.set(clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
      py.set(clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [full, reduce, px, py]);

  if (reduce) {
    return (
      <span aria-hidden className={`relative inline-block shrink-0 ${className}`}>
        <Image src={SRC} alt="" fill sizes="128px" className="object-contain drop-shadow-[0_6px_10px_rgba(14,14,14,0.25)]" />
      </span>
    );
  }

  const float =
    mood === "thinking"
      ? { y: ["0%", "-6%", "0%"], rotateZ: [-2, 2, -2] }
      : mood === "speaking"
        ? { y: ["0%", "-2%", "0%"], rotateX: [0, 6, 0] }
        : { y: ["0%", "-3%", "0%"], rotateY: [-6, 6, -6], rotateZ: [-1, 1, -1] };
  const floatDuration = mood === "thinking" ? 1.8 : mood === "speaking" ? 0.6 : 5;

  return (
    <span ref={root} aria-hidden className={`relative inline-block shrink-0 ${className}`} style={{ perspective: 600 }}>
      {/* Contact shadow: shrinks and fades as Jax floats up. */}
      <motion.span
        className="absolute bottom-[-6%] left-1/2 h-[9%] w-[56%] -translate-x-1/2 rounded-[50%] bg-[#0e0e0e]/20 blur-[3px]"
        animate={{ scaleX: [1, 0.82, 1], opacity: [0.55, 0.3, 0.55] }}
        transition={{ duration: floatDuration, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Pointer tilt (outer) + idle motion (inner), so both combine in 3D. */}
      <motion.span className="absolute inset-0" style={full ? { rotateX, rotateY, transformStyle: "preserve-3d" } : undefined}>
        <motion.span
          className="absolute inset-0"
          style={{ transformStyle: "preserve-3d" }}
          animate={float}
          transition={{ duration: floatDuration, repeat: Infinity, ease: "easeInOut" }}
        >
          <Image
            src={SRC}
            alt=""
            fill
            sizes={full ? "(min-width: 768px) 160px, 112px" : "48px"}
            className="object-contain drop-shadow-[0_6px_10px_rgba(14,14,14,0.25)]"
          />

          {/* Specular sheen sweeping across the figure, clipped to its silhouette. */}
          {full && (
            <span
              className="absolute inset-0 overflow-hidden"
              style={{
                maskImage: `url(${SRC})`,
                WebkitMaskImage: `url(${SRC})`,
                maskSize: "contain",
                WebkitMaskSize: "contain",
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
                maskPosition: "center",
                WebkitMaskPosition: "center",
              }}
            >
              <motion.span
                className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent"
                style={{ skewX: -20 }}
                animate={{ x: ["-120%", "320%"] }}
                transition={{
                  duration: mood === "speaking" ? 1.2 : 1.6,
                  repeat: Infinity,
                  repeatDelay: mood === "idle" ? 5 : 1.4,
                  ease: "easeInOut",
                }}
              />
            </span>
          )}

          {/* Eyes: glow, look toward the pointer, and blink now and then. */}
          {EYES.map((eye, i) => (
            <motion.span
              key={i}
              className="absolute"
              style={{
                left: `${eye.x}%`,
                top: `${eye.y}%`,
                width: "12%",
                height: "12%",
                translate: "-50% -50%",
                ...(full ? { x: lookX, y: lookY } : {}),
              }}
            >
              <motion.span
                className="absolute inset-0 rounded-full"
                style={{ background: GLOW, mixBlendMode: "screen" }}
                animate={
                  mood === "thinking"
                    ? { opacity: [0.15, 1, 0.15], scale: [0.8, 1.15, 0.8] }
                    : mood === "speaking"
                      ? { opacity: [0.55, 1, 0.55], scale: [0.9, 1.2, 0.9] }
                      : { opacity: [0.35, 0.7, 0.35], scale: [0.9, 1, 0.9] }
                }
                transition={
                  mood === "thinking"
                    ? { duration: 1.2, repeat: Infinity, delay: [0, 0.3, 0.9, 0.6][i], ease: "easeInOut" }
                    : mood === "speaking"
                      ? { duration: 0.5, repeat: Infinity, delay: i * 0.06, ease: "easeInOut" }
                      : { duration: 3.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }
                }
              />
            </motion.span>
          ))}
          {mood !== "thinking" &&
            EYES.map((eye, i) => (
              <motion.span
                key={`lid-${i}`}
                className="absolute rounded-full"
                style={{
                  left: `${eye.x}%`,
                  top: `${eye.y}%`,
                  width: `${EYE_LID}%`,
                  height: `${EYE_LID}%`,
                  translate: "-50% -50%",
                  background: LID,
                }}
                animate={{ opacity: [0, 0, 1, 0, 0], scaleY: [0.2, 0.2, 1, 0.2, 0.2] }}
                transition={{ duration: 4.8, repeat: Infinity, times: [0, 0.9, 0.93, 0.96, 1], ease: "easeInOut" }}
              />
            ))}
        </motion.span>
      </motion.span>

      {/* Thinking: particles orbiting the head on a tilted ring. */}
      {full && mood === "thinking" && (
        <span className="pointer-events-none absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
          <motion.span
            className="absolute inset-[-8%]"
            style={{ rotateX: 68, transformStyle: "preserve-3d" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.span
              className="absolute inset-0"
              animate={{ rotateZ: 360 }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
            >
              {[0, 120, 240].map((deg) => (
                <span
                  key={deg}
                  className="absolute left-1/2 top-1/2 size-[7%] rounded-full bg-[#ffd000] shadow-[0_0_8px_rgba(255,208,0,0.9)]"
                  style={{ transform: `rotate(${deg}deg) translateX(330%)` }}
                />
              ))}
            </motion.span>
          </motion.span>
        </span>
      )}
    </span>
  );
}

