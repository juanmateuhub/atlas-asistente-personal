/** Remounts on every navigation: one quiet entrance for the page content. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="flex animate-enter flex-col gap-8">{children}</div>;
}
