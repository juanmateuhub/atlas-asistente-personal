export function PageHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-title font-bold md:text-display">{title}</h1>
      {lead && <p className="text-base text-muted md:text-lead md:font-medium">{lead}</p>}
    </header>
  );
}
