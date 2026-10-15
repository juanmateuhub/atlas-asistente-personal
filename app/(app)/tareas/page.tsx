import type { Metadata } from "next";
import { Suspense } from "react";
import { TaskBoard } from "@/components/tasks/task-board";
import { todayIn } from "@/lib/tasks/dates";
import { listTasks } from "@/lib/tasks/queries";
import { parseFilter } from "@/lib/tasks/types";

export const metadata: Metadata = { title: "Tareas" };

export default function TareasPage({ searchParams }: PageProps<"/tareas">) {
  return (
    <div className="animate-rise">
      <h1 className="mb-[14px] text-[clamp(48px,7vw,88px)] leading-[0.95] font-extrabold tracking-[-0.05em]">Tareas</h1>
      <p className="mb-[44px] text-[clamp(19px,2vw,23px)] leading-[1.35] text-neutral-300">Lo que tienes que hacer, ordenado.</p>
      <Suspense fallback={<BoardSkeleton />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Board({ searchParams }: Pick<PageProps<"/tareas">, "searchParams">) {
  // All tasks: the board filters locally so the pill can slide and rows can animate out.
  const [{ estado }, tasks] = await Promise.all([searchParams, listTasks("todas")]);
  return <TaskBoard tasks={tasks} today={todayIn(new Date())} initialFilter={parseFilter(estado)} />;
}

function BoardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      <div className="h-14 animate-skeleton rounded-full bg-step" />
      <div className="mt-[36px] mb-[18px] h-10 w-[368px] max-w-full animate-skeleton rounded-full bg-step" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="my-[14px] flex items-center gap-4">
          <div className="size-6 rounded-full border-[1.5px] border-neutral-700" />
          <div className="h-4 w-1/2 animate-skeleton rounded bg-step" />
        </div>
      ))}
    </div>
  );
}
