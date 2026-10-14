"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckSquare } from "lucide-react";
import { startTransition, useOptimistic } from "react";
import { toggleTaskDone } from "@/app/(app)/tareas/actions";
import { EmptyState } from "@/components/ui/empty-state";
import { dueInfo } from "@/lib/tasks/dates";
import type { Task, TaskFilter } from "@/lib/tasks/types";
import { NewTaskForm } from "./new-task-form";
import { TaskItem } from "./task-item";

const EMPTY: Record<TaskFilter, { title: string; description: string }> = {
  pendientes: {
    title: "Nada pendiente",
    description: "Añade una tarea arriba para empezar a organizarte.",
  },
  hechas: { title: "Aún no has terminado ninguna", description: "Las tareas hechas aparecerán aquí." },
  todas: { title: "Sin tareas", description: "Añade una tarea arriba para empezar a organizarte." },
};

type OptimisticAction = { type: "add"; task: Task } | { type: "toggle"; id: string; done: boolean };

function reduce(tasks: Task[], action: OptimisticAction): Task[] {
  switch (action.type) {
    case "add":
      return [...tasks, action.task];
    case "toggle":
      return tasks.map((t) =>
        t.id === action.id ? { ...t, status: action.done ? "hecha" : "pendiente" } : t,
      );
  }
}

/**
 * Task list with optimistic updates: toggles and new tasks show instantly, then
 * the server refresh reconciles (and filtered-out rows animate away).
 */
export function TaskBoard({
  tasks,
  filter,
  today,
  filters,
}: {
  tasks: Task[];
  filter: TaskFilter;
  today: string;
  filters: React.ReactNode;
}) {
  const [optimisticTasks, apply] = useOptimistic(tasks, reduce);

  function toggle(task: Task) {
    const done = task.status !== "hecha";
    const fd = new FormData();
    fd.set("id", task.id);
    fd.set("done", String(done));
    startTransition(async () => {
      apply({ type: "toggle", id: task.id, done });
      await toggleTaskDone(fd);
    });
  }

  const showEmpty = optimisticTasks.length === 0;

  return (
    <>
      <NewTaskForm
        onOptimisticAdd={(task) => {
          // A new task is pending, so it does not belong in the "hechas" view.
          if (filter !== "hechas") apply({ type: "add", task });
        }}
      />

      <section aria-labelledby="task-list-title" className="flex flex-col gap-4">
        <h2 id="task-list-title" className="sr-only">
          Lista de tareas
        </h2>
        {filters}

        {showEmpty ? (
          <EmptyState icon={CheckSquare} {...EMPTY[filter]} />
        ) : (
          <motion.ul layout className="flex flex-col">
            <AnimatePresence initial={false} mode="popLayout">
              {optimisticTasks.map((task) => (
                <motion.li
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 24, transition: { duration: 0.16 } }}
                >
                  <TaskItem
                    task={task}
                    due={task.dueDate ? dueInfo(task.dueDate, today) : null}
                    pending={task.id.startsWith("tmp-")}
                    onToggle={() => toggle(task)}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </section>
    </>
  );
}
