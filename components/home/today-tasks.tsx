"use client";

import { AnimatePresence, motion } from "motion/react";
import { startTransition, useOptimistic } from "react";
import { toggleTaskDone } from "@/app/(app)/tareas/actions";
import { TaskItem } from "@/components/tasks/task-item";
import { dueInfo } from "@/lib/tasks/dates";
import type { Task } from "@/lib/tasks/types";

/** Due/overdue tasks on Inicio. Completing one checks it instantly, then it slides away. */
export function TodayTasks({ tasks, today }: { tasks: Task[]; today: string }) {
  const [optimistic, markDone] = useOptimistic(tasks, (list, id: string) =>
    list.map((t) => (t.id === id ? { ...t, status: "hecha" as const } : t)),
  );

  function complete(task: Task) {
    const fd = new FormData();
    fd.set("id", task.id);
    fd.set("done", "true");
    startTransition(async () => {
      markDone(task.id);
      await toggleTaskDone(fd);
    });
  }

  return (
    <ul className="flex flex-col">
      <AnimatePresence initial={false} mode="popLayout">
        {optimistic.map((task) => (
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
              pending={false}
              onToggle={() => complete(task)}
            />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
