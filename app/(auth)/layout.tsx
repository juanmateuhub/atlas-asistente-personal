import { AtlasLogo } from "@/components/brand/atlas-logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-line/15 px-4 py-12">
      <div className="flex w-full max-w-md animate-enter flex-col gap-8 rounded-atlas border border-line bg-surface p-8">
        <AtlasLogo className="size-10" />
        {children}
      </div>
    </main>
  );
}
