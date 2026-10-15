/** Nocturne empty state: glowing icon tile, title and one helpful line. */
export function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <section
      className="flex animate-rise flex-col items-start gap-[14px] rounded-[20px] px-6 py-[26px]"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 92%, transparent), color-mix(in srgb, var(--color-surface) 55%, transparent))",
        boxShadow:
          "inset 0 1px 0 color-mix(in srgb, var(--color-text) 8%, transparent), 0 0 0 1px color-mix(in srgb, var(--color-text) 5%, transparent), 0 24px 60px rgba(0,0,0,.38)",
      }}
    >
      <span
        aria-hidden
        className="grid size-[42px] place-items-center rounded-[13px] text-accent-300"
        style={{
          background: "radial-gradient(circle at 50% 0%, var(--color-accent-800), var(--color-accent-900))",
          boxShadow: "0 0 0 1px var(--color-accent-800), 0 0 22px color-mix(in srgb, var(--color-accent) 22%, transparent)",
        }}
      >
        {icon}
      </span>
      <h2 className="m-0 text-[20px] tracking-[-0.015em]">{title}</h2>
      <p className="m-0 max-w-md text-[15px] leading-[1.5] text-neutral-400">{description}</p>
    </section>
  );
}
