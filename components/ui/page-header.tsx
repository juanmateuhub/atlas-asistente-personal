/** Nocturne screen title: big tight heading and a quiet lead line. */
export function PageHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <header>
      <h1 className="m-0 mb-[14px] text-[clamp(48px,7vw,88px)] leading-[0.95] font-extrabold tracking-[-0.05em]">{title}</h1>
      {lead && <p className="m-0 text-[clamp(19px,2vw,23px)] leading-[1.35] text-neutral-300">{lead}</p>}
    </header>
  );
}
