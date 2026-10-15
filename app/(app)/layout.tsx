import { Suspense } from "react";
import { Ambient } from "@/components/shell/ambient";
import { Sidebar, SidebarFrame, TabBar, TabBarFrame } from "@/components/shell/app-nav";
import { AtlasLogo } from "@/components/brand/atlas-logo";
import { JaxLauncher } from "@/components/jax/jax-launcher";
import { UserMenu } from "@/components/shell/user-menu";
import { MotionProvider } from "@/components/ui/motion";
import { ToastProvider } from "@/components/ui/toast";
import { countPendingTasks } from "@/lib/tasks/queries";

/** Sidebar with the pending-tasks badge (reads the session: streams in). */
async function SidebarWithBadge() {
  const pending = await countPendingTasks();
  return (
    <Sidebar
      pendingCount={pending}
      footer={
        <Suspense fallback={<div aria-hidden className="h-[50px]" />}>
          <UserMenu />
        </Suspense>
      }
    />
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <MotionProvider>
      <ToastProvider>
        <div className="relative flex min-h-dvh overflow-clip bg-bg text-text">
          <Ambient />
          <Suspense fallback={<SidebarFrame pathname={null} />}>
            <SidebarWithBadge />
          </Suspense>
          <main className="relative z-[1] min-w-0 flex-1 px-4 pt-[max(env(safe-area-inset-top),16px)] pb-28 md:px-[clamp(28px,6vw,96px)] md:pt-[72px] md:pb-[120px]">
            {/* The fixed Jax avatar (JaxLauncher) sits at the right; sign-out lives at the end of Inicio on mobile. */}
            <div className="flex h-[30px] items-center pb-4 md:hidden">
              <span className="flex items-center gap-[10px] text-[17px] font-medium tracking-[-0.025em]">
                <AtlasLogo className="size-[26px]" />
                Atlas
              </span>
            </div>
            <div className="mx-auto max-w-[1120px]">{children}</div>
          </main>
          <Suspense fallback={<TabBarFrame pathname={null} />}>
            <TabBar />
          </Suspense>
          <Suspense fallback={null}>
            <JaxLauncher />
          </Suspense>
        </div>
      </ToastProvider>
    </MotionProvider>
  );
}
