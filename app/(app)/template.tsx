/** Remounts on every navigation; each screen brings its own atlasRise entrance. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-8">{children}</div>;
}
