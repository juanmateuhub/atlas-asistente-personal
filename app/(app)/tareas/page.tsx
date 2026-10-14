import type { Metadata } from "next";
import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { Suspense } from "react";
import { NewTaskForm } from "@/components/tasks/new-task-form";
import { TaskItem } from "@/components/tasks/task-item";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { dueInfo, todayIn } from "@/lib/tasks/dates";
import { listTasks } from "@/lib/tasks/queries";
import { FILTERS, parseFilter, type TaskFilter } from "@/lib/tasks/types";

export const metadata: Metadata = { title: "Tareas" };

const FILTER_LABEL: Record<TaskFilter, string> = {
  pendientes: "Pendientes",
  hechas: "Hechas",
  todas: "Todas",
};

const EMPTY: Record<TaskFilter, { title: string; description: string }> = {
  pendientes: {
    title: "Nada pendiente",
    description: "Añade una tarea arriba para empezar a organizarte.",
  },
  hechas: { title: "Aún no has terminado ninguna", description: "Las tareas hechas aparecerán aquí." },
  todas: { title: "Sin tareas", description: "Añade una tarea arriba para empezar a organizarte." },
};

export default function TareasPage({ searchParams }: PageProps<"/tareas">) {
  return (
    <>
      <PageHeader title="Tareas" lead="Lo que tienes que hacer, ordenado." />
      <NewTaskForm />
      <Suspense fallback={<ListSkeleton />}>
        <TaskList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function TaskList({ searchParams }: Pick<PageProps<"/tareas">, "searchParams">) {
  const filter = parseFilter((await searchParams).estado);
  const tasks = await listTasks(filter);
  const today = todayIn(new Date());

  return (
    <section aria-labelledby="task-list-title" className="flex flex-col gap-4">
      <h2 id="task-list-title" className="sr-only">
        Lista de tareas
      </h2>
      <nav aria-label="Filtrar tareas" className="flex gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "pendientes" ? "/tareas" : `/tareas?estado=${f}`}
            aria-current={f === filter ? "page" : undefined}
            className={`rounded-atlas px-4 py-2 text-sm font-medium ${
              f === filter ? "bg-raised text-white" : "text-body hover:bg-raised hover:text-white"
            }`}
          >
            {FILTER_LABEL[f]}
          </Link>
        ))}
      </nav>

      {tasks.length === 0 ? (
        <EmptyState icon={CheckSquare} {...EMPTY[filter]} />
      ) : (
        <ul className="rounded-atlas border border-line px-4">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              due={task.dueDate ? dueInfo(task.dueDate, today) : null}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className="h-9 w-72 rounded-atlas border border-line" />
      <div className="h-48 rounded-atlas border border-line" />
    </div>
  );
}
