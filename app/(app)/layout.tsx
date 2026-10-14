import { Suspense } from "react";
import { Sidebar, SidebarFrame, TabBar, TabBarFrame } from "@/components/shell/app-nav";
import { AtlasMark } from "@/components/shell/atlas-mark";
import { UserMenu } from "@/components/shell/user-menu";
import { MotionProvider } from "@/components/ui/motion";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <MotionProvider>
      <div className="flex min-h-dvh">
        <Suspense fallback={<SidebarFrame pathname={null} />}>
          <Sidebar
            footer={
              <Suspense fallback={<div aria-hidden className="h-10" />}>
                <UserMenu />
              </Suspense>
            }
          />
        </Suspense>
        <main className="min-w-0 flex-1 px-4 pt-[max(env(safe-area-inset-top),16px)] pb-28 md:px-12 md:pt-12 md:pb-12">
          <div className="flex items-center justify-between md:hidden">
            <span className="flex items-center gap-2 text-base font-bold text-ink">
              <AtlasMark className="size-6" />
              Atlas
            </span>
            <Suspense fallback={<div aria-hidden className="size-10" />}>
              <UserMenu compact />
            </Suspense>
          </div>
          <div className="mx-auto max-w-4xl pt-4 md:pt-0">{children}</div>
        </main>
        <Suspense fallback={<TabBarFrame pathname={null} />}>
          <TabBar />
        </Suspense>
      </div>
    </MotionProvider>
  );
}
