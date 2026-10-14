"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, RotateCcw, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { clearConversation } from "@/app/(app)/jax/actions";
import { ActionDialog } from "@/components/ui/action-dialog";
import { secondaryButtonClass } from "@/components/ui/form";
import type { Citation } from "@/lib/jax/context";
import type { JaxActionView } from "@/lib/jax/conversation";
import { createSSEParser } from "@/lib/jax/sse";
import { ActionCards } from "./action-cards";
import { Answer } from "./answer";
import { JaxAvatar } from "./jax-avatar";

type Message = { id: string; role: "user" | "assistant"; content: string; citations: Citation[]; actions: JaxActionView[] };

const SUGGESTIONS = [
  "¿Qué tengo pendiente para hoy?",
  "¿Cuándo es mi próximo examen?",
  "Añade una tarea: repasar Redes mañana",
  "¿Qué tengo esta semana en el calendario?",
];

const MAX = 2000;
/** If the server sends nothing for this long, stop waiting and say so. */
const SILENCE_TIMEOUT_MS = 60_000;

export function JaxChat({ initialMessages }: { initialMessages: Message[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [, startTransition] = useTransition();
  const router = useRouter();
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const streaming = draft !== null;

  // Keep the newest content in view while the answer streams in.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, draft]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || streaming) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", content: text, citations: [], actions: [] }]);
    setDraft("");

    const controller = new AbortController();
    abort.current = controller;
    let timedOut = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const resetWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, SILENCE_TIMEOUT_MS);
    };
    resetWatchdog();
    try {
      const res = await fetch("/api/jax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No he podido responder. Inténtalo de nuevo.");
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      const parse = createSSEParser();
      let finished = false;
      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        resetWatchdog();
        for (const { event, data } of parse(value)) {
          if (event === "draft") {
            setDraft((d) => (d ?? "") + (data as { delta: string }).delta);
          } else if (event === "final") {
            const final = data as { id: string; content: string; citations: Citation[]; actions: JaxActionView[] };
            setMessages((m) => [...m, { ...final, role: "assistant" }]);
            // Jax changed data: refresh cached views (Inicio, Tareas…) in the background.
            if (final.actions.length) router.refresh();
            finished = true;
          } else if (event === "error") {
            throw new Error((data as { message: string }).message);
          }
        }
      }
      if (!finished && !controller.signal.aborted) throw new Error("La respuesta se ha cortado. Inténtalo de nuevo.");
    } catch (err) {
      if (timedOut) setError("Jax está tardando demasiado en responder. Inténtalo de nuevo en un momento.");
      else if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "No he podido responder.");
    } finally {
      clearTimeout(watchdog);
      setDraft(null);
      abort.current = null;
    }
  }

  const mood = streaming ? (draft ? "speaking" : "thinking") : "idle";

  return (
    <div className="flex min-h-[calc(100dvh-96px)] flex-col gap-8">
      <header className="flex items-center gap-4 md:gap-6">
        <JaxAvatar mood={mood} detail="full" className="size-24 md:size-32" />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-title font-bold md:text-display">Jax</h1>
          <p className="text-base text-muted md:text-lead md:font-medium">Tu asistente: conoce tu agenda y tus apuntes.</p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6" aria-live="polite">
        {messages.length === 0 && !streaming && (
          <div className="flex animate-enter flex-col items-start gap-6 py-2">
            <div className="flex flex-col gap-2">
              <h2 className="text-lead font-medium">Pregúntame por tu día, tus exámenes o tus apuntes</h2>
              <p className="max-w-xl text-base text-muted">
                Leo tus tareas, exámenes, eventos y apuntes para responderte, y puedo hacer cambios por ti: crear o editar tareas, eventos, exámenes y apuntes. Cada cambio se puede deshacer. La conversación se borra a los 7 días.
              </p>
            </div>
            <ul className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => void ask(s)}
                    className="pressable w-full rounded-atlas border border-line px-4 py-3 text-left text-sm text-body hover:border-accent hover:text-ink"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={m.role === "user" ? "flex justify-end" : "flex gap-3"}
            >
              {m.role === "user" ? (
                <p className="max-w-[85%] whitespace-pre-wrap rounded-atlas bg-accent px-4 py-3 text-base text-white">
                  {m.content}
                </p>
              ) : (
                <>
                  <JaxAvatar className="mt-0.5 size-8" />
                  <div className="min-w-0 flex-1 text-base leading-relaxed text-body">
                    <Answer content={m.content} citations={m.citations} />
                    {m.actions.length > 0 && <ActionCards actions={m.actions} />}
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {streaming && (
          <div className="flex gap-3">
            <JaxAvatar mood={draft ? "speaking" : "thinking"} className="mt-0.5 size-8" />
            <div className="min-w-0 flex-1 text-base leading-relaxed text-body">
              {draft ? <Answer content={draft} citations={[]} /> : <Thinking />}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="animate-enter rounded-atlas bg-line/20 px-4 py-3 text-sm text-ink">
            {error}
          </p>
        )}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-24 flex flex-col gap-2 bg-surface/90 pt-2 pb-2 backdrop-blur-sm md:bottom-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
          className="flex items-end gap-2 rounded-atlas border border-line p-2 focus-within:border-accent"
        >
          <label htmlFor="jax-input" className="sr-only">
            Pregunta para Jax
          </label>
          <textarea
            id="jax-input"
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void ask(input);
              }
            }}
            rows={1}
            maxLength={MAX}
            placeholder="Pregunta a Jax…"
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-base text-ink placeholder:text-muted focus-visible:outline-none [field-sizing:content]"
          />
          {streaming ? (
            <button
              type="button"
              onClick={() => abort.current?.abort()}
              aria-label="Detener respuesta"
              className="pressable flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white"
            >
              <Square aria-hidden className="size-4 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Enviar"
              className="pressable flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-raised"
            >
              <ArrowUp aria-hidden className="size-5" />
            </button>
          )}
        </form>
        <div className="flex items-center justify-between gap-4 px-2">
          <p className="text-xs text-muted">Jax puede equivocarse. Comprueba lo importante.</p>
          {messages.length > 0 && !streaming && (
            <ActionDialog
              title="¿Empezar una conversación nueva?"
              action={async () => {
                const result = await clearConversation();
                if (result.ok) startTransition(() => setMessages([]));
                return result;
              }}
              submitLabel="Borrar conversación"
              pendingLabel="Borrando…"
              danger
              trigger={(open) => (
                <button type="button" onClick={open} className={`${secondaryButtonClass} inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-1.5 text-xs`}>
                  <RotateCcw aria-hidden className="size-3.5" />
                  Nueva conversación
                </button>
              )}
            >
              <p className="text-base">Se borrarán todos los mensajes de esta conversación. No se puede deshacer.</p>
            </ActionDialog>
          )}
        </div>
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <span role="status" aria-label="Jax está pensando" className="flex h-7 items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-2 rounded-full bg-accent"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}
