"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  Check,
  CheckSquare,
  FileText,
  GraduationCap,
  Layers,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { resolveJaxAction } from "@/app/(app)/jax/actions";
import type { JaxActionStatus, JaxActionView } from "@/lib/jax/conversation";

const ICON = {
  task: CheckSquare,
  event: CalendarClock,
  exam: GraduationCap,
  subject: BookOpen,
  topic: Layers,
  page: FileText,
} as const;

type CardState = { status: JaxActionStatus; href: string | null; error?: string };

/** Changes Jax made under its answer: each one links to the result and can be undone. */
export function ActionCards({ actions }: { actions: (JaxActionView & { error?: string })[] }) {
  const [state, setState] = useState(
    () => new Map<string, CardState>(actions.map((a) => [a.id, { status: a.status, href: a.href, error: a.error }])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(id: string, decision: "apply" | "undo") {
    setBusy(id);
    startTransition(async () => {
      const result = await resolveJaxAction(id, decision);
      setState((s) => {
        const prev = s.get(id);
        return new Map(s).set(id, { status: result.status, href: result.href ?? prev?.href ?? null, error: result.error });
      });
      setBusy(null);
    });
  }

  return (
    <ul className="flex flex-col gap-2 pt-1">
      {actions.map((action, index) => {
        const entity = action.kind.split(".")[0] as keyof typeof ICON;
        const isDelete = action.kind.endsWith(".delete");
        const Icon = isDelete ? Trash2 : (ICON[entity] ?? CheckSquare);
        const current = state.get(action.id) ?? { status: action.status, href: action.href };
        const done = current.status === "applied";
        const reverted = current.status === "undone" || current.status === "dismissed";

        return (
          <motion.li
            key={action.id}
            layout
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: index * 0.06, type: "spring", stiffness: 420, damping: 32 }}
            className={`flex items-center gap-3 rounded-atlas border px-4 py-3 ${
              done ? "border-accent/30 bg-line/10" : "border-line"
            }`}
          >
            <span
              className={`relative flex size-9 shrink-0 items-center justify-center rounded-full ${
                isDelete ? "bg-red-50 text-red-700" : "bg-line/30 text-accent-ink"
              }`}
            >
              <Icon aria-hidden className="size-4" />
              <AnimatePresence>
                {done && (
                  <motion.span
                    key="tick"
                    className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-accent text-on-accent ring-2 ring-surface"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 600, damping: 22, delay: 0.15 + index * 0.06 }}
                  >
                    <Check aria-hidden className="size-2.5" strokeWidth={4} />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>

            <div className="flex min-w-0 flex-1 flex-col">
              <span className={`text-sm ${reverted ? "text-muted line-through" : "text-ink"}`}>{action.summary}</span>
              <span className="text-xs text-muted">
                {current.error ? (
                  <span className="text-red-700">{current.error}</span>
                ) : done ? (
                  "Hecho"
                ) : current.status === "undone" ? (
                  "Deshecho"
                ) : current.status === "dismissed" ? (
                  "Descartado"
                ) : current.status === "failed" ? (
                  <span className="text-red-700">No se pudo aplicar</span>
                ) : (
                  "Pendiente de confirmar"
                )}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {done && current.href && !isDelete && (
                <Link
                  href={current.href}
                  className="pressable inline-flex items-center gap-1 rounded-atlas px-2.5 py-1.5 text-xs font-medium text-accent-ink hover:bg-line/30"
                >
                  Ver
                  <ArrowUpRight aria-hidden className="size-3.5" />
                </Link>
              )}
              {done && (
                <button
                  type="button"
                  disabled={busy === action.id}
                  onClick={() => run(action.id, "undo")}
                  className="pressable inline-flex items-center gap-1 rounded-atlas px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-line/30 hover:text-ink"
                >
                  <RotateCcw aria-hidden className="size-3.5" />
                  Deshacer
                </button>
              )}
              {current.status === "pending" && (
                <button
                  type="button"
                  disabled={busy === action.id}
                  onClick={() => run(action.id, "apply")}
                  aria-label={`Aplicar: ${action.summary}`}
                  className="pressable flex size-9 items-center justify-center rounded-full bg-accent text-on-accent hover:bg-accent-500"
                >
                  <Check aria-hidden className="size-4" />
                </button>
              )}
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
