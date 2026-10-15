/** Empty state: a white card with a yellow icon tile, a title and one helpful line. */
export function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <section className="flex animate-rise flex-col items-start gap-[14px] rounded-[22px] bg-surface px-6 py-[26px]">
      <span aria-hidden className="grid size-[44px] place-items-center rounded-[14px] bg-accent text-on-accent">
        {icon}
      </span>
      <h2 className="m-0 text-[24px] tracking-[-0.035em]">{title}</h2>
      <p className="m-0 max-w-md text-[15.5px] leading-[1.5] text-neutral-400">{description}</p>
    </section>
  );
}
