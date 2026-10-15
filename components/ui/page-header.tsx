/** Nocturne screen title: big tight heading and a quiet lead line. */
export function PageHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <header>
      <h1 className="m-0 mb-[14px] text-[clamp(44px,6vw,68px)] leading-[1.02] tracking-[-0.04em]">{title}</h1>
      {lead && <p className="m-0 text-[21px] tracking-[-0.012em] text-neutral-400">{lead}</p>}
    </header>
  );
}
