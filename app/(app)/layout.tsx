import { Suspense } from "react";
import { Sidebar, TabBar } from "@/components/shell/app-nav";
import { UserMenu } from "@/components/shell/user-menu";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar
        footer={
          <Suspense fallback={<div aria-hidden className="h-10" />}>
            <UserMenu />
          </Suspense>
        }
      />
      <main className="flex-1 px-4 pt-[max(env(safe-area-inset-top),16px)] pb-28 md:px-12 md:pt-12 md:pb-12">
        <div className="flex items-center justify-between md:hidden">
          <span className="text-base font-bold text-ink">Atlas</span>
          <Suspense fallback={<div aria-hidden className="size-10" />}>
            <UserMenu compact />
          </Suspense>
        </div>
        <div className="mx-auto flex max-w-5xl flex-col gap-8 pt-4 md:pt-0">{children}</div>
      </main>
      <TabBar />
    </div>
  );
}
