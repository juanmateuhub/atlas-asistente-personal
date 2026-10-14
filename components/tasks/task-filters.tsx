"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { FILTERS, type TaskFilter } from "@/lib/tasks/types";

const LABEL: Record<TaskFilter, string> = {
  pendientes: "Pendientes",
  hechas: "Hechas",
  todas: "Todas",
};

/** Segmented control; the selected pill slides between options. */
export function TaskFilters({ active }: { active: TaskFilter }) {
  return (
    <nav aria-label="Filtrar tareas" className="flex gap-1 self-start rounded-atlas bg-line/15 p-1">
      {FILTERS.map((f) => {
        const selected = f === active;
        return (
          <Link
            key={f}
            href={f === "pendientes" ? "/tareas" : `/tareas?estado=${f}`}
            aria-current={selected ? "page" : undefined}
            scroll={false}
            className={`pressable relative rounded-atlas px-4 py-2 text-sm font-medium ${
              selected ? "text-white" : "text-body hover:text-ink"
            }`}
          >
            {selected && (
              <motion.span
                layoutId="task-filter"
                aria-hidden
                className="absolute inset-0 rounded-atlas bg-raised"
              />
            )}
            <span className="relative">{LABEL[f]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
