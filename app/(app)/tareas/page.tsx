import type { Metadata } from "next";
import { Suspense } from "react";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskFilters } from "@/components/tasks/task-filters";
import { PageHeader } from "@/components/ui/page-header";
import { todayIn } from "@/lib/tasks/dates";
import { listTasks } from "@/lib/tasks/queries";
import { parseFilter } from "@/lib/tasks/types";

export const metadata: Metadata = { title: "Tareas" };

export default function TareasPage({ searchParams }: PageProps<"/tareas">) {
  return (
    <>
      <PageHeader title="Tareas" lead="Lo que tienes que hacer, ordenado." />
      <Suspense fallback={<BoardSkeleton />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Board({ searchParams }: Pick<PageProps<"/tareas">, "searchParams">) {
  const filter = parseFilter((await searchParams).estado);
  const tasks = await listTasks(filter);

  return (
    <TaskBoard
      tasks={tasks}
      filter={filter}
      today={todayIn(new Date())}
      filters={<TaskFilters active={filter} />}
    />
  );
}

function BoardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8">
      <div className="h-64 animate-skeleton rounded-atlas bg-line/20" />
      <div className="flex flex-col gap-3">
        <div className="h-9 w-72 animate-skeleton rounded-atlas bg-line/20" />
        <div className="h-14 animate-skeleton rounded-atlas bg-line/20" />
        <div className="h-14 animate-skeleton rounded-atlas bg-line/20" />
      </div>
    </div>
  );
}
