"use client";

import { Check } from "@phosphor-icons/react";

/** Ripple + 10 sparks fanning out from the check, as in the redesign. */
function Burst() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      <span
        className="absolute inset-[-1px] rounded-full border-2 border-accent-300"
        style={{ animation: "atlasRipple .6s cubic-bezier(.2,.8,.2,1) forwards" }}
      />
      {Array.from({ length: 10 }, (_, i) => {
        const small = i % 2 === 1;
        return (
          <span
            key={i}
            className="absolute top-1/2 left-1/2 rounded-[3px]"
            style={
              {
                width: small ? 3 : 5,
                height: small ? 3 : 5,
                margin: small ? -1.5 : -2.5,
                background: small ? "var(--color-accent-200)" : "var(--color-accent)",
                boxShadow: "0 0 6px var(--color-accent)",
                "--a": `${i * 36 + 8}deg`,
                animation: "atlasSpark .6s cubic-bezier(.2,.8,.2,1) forwards",
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}

/**
 * The round check: springs to 1.22× with a glow and a burst when a task is
 * completed (`pop`), shows a filled accent disc when `checked`.
 */
export function TaskCheck({
  checked,
  pop,
  disabled,
  label,
  onClick,
}: {
  checked: boolean;
  pop: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="relative grid size-6 flex-none cursor-pointer place-items-center rounded-full p-0 disabled:opacity-100"
      style={{
        border: `1.5px solid ${checked ? "var(--color-accent)" : "var(--color-neutral-600)"}`,
        background: checked ? "var(--color-accent)" : "transparent",
        transform: `scale(${pop ? 1.22 : 1})`,
        boxShadow: pop
          ? "0 0 0 6px color-mix(in srgb, var(--color-accent) 18%, transparent), 0 0 26px color-mix(in srgb, var(--color-accent) 65%, transparent)"
          : "none",
        transition:
          "background .3s, border-color .3s, transform .5s cubic-bezier(.34,1.9,.5,1), box-shadow .4s",
      }}
    >
      <Check
        weight="bold"
        size={13}
        color="var(--color-bg)"
        style={{
          opacity: checked ? 1 : 0,
          transform: `scale(${checked ? 1 : 0})`,
          transition: "opacity .2s, transform .4s cubic-bezier(.34,1.9,.5,1)",
        }}
      />
      {pop && <Burst />}
    </button>
  );
}
