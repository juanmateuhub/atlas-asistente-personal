"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  BellRing,
  Dumbbell,
  BookOpen,
  Brain,
  CalendarClock,
  Check,
  CheckSquare,
  FileText,
  GraduationCap,
  Layers,
  ListChecks,
  PersonStanding,
  RotateCcw,
  Scale,
  Send,
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
  reminder: BellRing,
  memory: Brain,
  mail: Send,
  workout: Dumbbell,
  routine: ListChecks,
  weight: Scale,
  muscle: PersonStanding,
} as const;

type CardState = { status: JaxActionStatus; href: string | null; error?: string };

/**
 * Changes Jax made under its answer: each one links to the result and can be
 * undone. Mail drafts are shown in full and only go out when the user taps Enviar.
 */
export function ActionCards({ actions }: { actions: (JaxActionView & { error?: string })[] }) {
  const [state, setState] = useState(
    () => new Map<string, CardState>(actions.map((a) => [a.id, { status: a.status, href: a.href, error: a.error }])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(id: string, decision: "apply" | "undo" | "dismiss") {
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
        const isMail = action.kind === "mail.send";
        const reverted = current.status === "undone" || current.status === "dismissed";

        return (
          <motion.li
            key={action.id}
            layout
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: index * 0.06, type: "spring", stiffness: 420, damping: 32 }}
            className={`flex flex-wrap items-center gap-3 rounded-atlas border px-4 py-3 ${
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
                  isMail ? "Enviado" : "Hecho"
                ) : current.status === "undone" ? (
                  "Deshecho"
                ) : current.status === "dismissed" ? (
                  "Descartado"
                ) : current.status === "failed" ? (
                  <span className="text-red-700">No se pudo aplicar</span>
                ) : isMail ? (
                  "Borrador: revísalo antes de enviarlo"
                ) : (
                  "Pendiente de confirmar"
                )}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {done && current.href && !isDelete && entity !== "memory" && (
                <Link
                  href={current.href}
                  className="pressable inline-flex items-center gap-1 rounded-atlas px-2.5 py-1.5 text-xs font-medium text-accent-ink hover:bg-line/30"
                >
                  Ver
                  <ArrowUpRight aria-hidden className="size-3.5" />
                </Link>
              )}
              {done && !isMail && (
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
              {current.status === "pending" && !isMail && (
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
            {isMail && action.mail && (
              <MailDraft
                mail={action.mail}
                pending={current.status === "pending"}
                busy={busy === action.id}
                onSend={() => run(action.id, "apply")}
                onDiscard={() => run(action.id, "dismiss")}
              />
            )}
          </motion.li>
        );
      })}
    </ul>
  );
}

/** The full draft under a mail card, with the only buttons that send it. */
function MailDraft({
  mail,
  pending,
  busy,
  onSend,
  onDiscard,
}: {
  mail: NonNullable<JaxActionView["mail"]>;
  pending: boolean;
  busy: boolean;
  onSend: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex w-full flex-col gap-3 rounded-[14px] bg-surface p-4">
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
        <dt className="text-neutral-500">Para</dt>
        <dd className="m-0 [overflow-wrap:anywhere]">{mail.to.join(", ") || "El remitente del correo"}</dd>
        <dt className="text-neutral-500">Asunto</dt>
        <dd className="m-0 font-medium [overflow-wrap:anywhere]">{mail.subject}</dd>
      </dl>
      <p className="m-0 max-h-64 overflow-y-auto text-[14px] leading-[1.55] whitespace-pre-wrap text-neutral-300">{mail.body}</p>
      {pending && (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onDiscard}
            disabled={busy}
            className="pressable inline-flex h-9 items-center rounded-full bg-step px-4 text-[13.5px] font-medium hover:bg-neutral-800"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={busy}
            className="pressable inline-flex h-9 items-center gap-[6px] rounded-full bg-accent px-4 text-[13.5px] font-semibold text-on-accent hover:bg-accent-500"
          >
            <Send aria-hidden className="size-3.5" />
            {busy ? "Enviando…" : "Enviar"}
          </button>
        </div>
      )}
    </div>
  );
}
