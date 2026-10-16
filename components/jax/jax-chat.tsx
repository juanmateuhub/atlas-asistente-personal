"use client";

import { ArrowCounterClockwise, ArrowUp, Sparkle, Stop } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { clearConversation } from "@/app/(app)/jax/actions";
import { ActionDialog } from "@/components/ui/action-dialog";
import type { Citation } from "@/lib/jax/context";
import type { JaxActionView } from "@/lib/jax/conversation";
import { createSSEParser } from "@/lib/jax/sse";
import { ActionCards } from "./action-cards";
import { Answer } from "./answer";
import { JaxAvatar, type JaxMood } from "./jax-avatar";
import { MemoryDialog } from "./memory-dialog";

export type JaxChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  actions: JaxActionView[];
};

const SUGGESTIONS = [
  "¿Qué tengo pendiente para hoy?",
  "Recuérdame mañana a las 9 llevar el portátil",
  "¿Tengo algún correo importante sin leer?",
  "¿Qué tengo esta semana en el calendario?",
];

const MAX = 2000;
/** If the server sends nothing for this long, stop waiting and say so. */
const SILENCE_TIMEOUT_MS = 60_000;

// Flat white composer; focus draws an ink ring (no glow), like Tareas.
const COMPOSER_SHADOW = { idle: "none", focus: "0 0 0 2px var(--color-text)" };

/**
 * The Jax conversation. "page" is the full /jax screen (composer pinned to the
 * viewport bottom); "panel" fills the dropdown opened from the top-right avatar
 * (its own scroll area, composer at the bottom of the panel).
 */
export function JaxChat({
  initialMessages,
  variant = "page",
  onMood,
}: {
  initialMessages: JaxChatMessage[];
  variant?: "page" | "panel";
  /** Lets the launcher avatar react while Jax thinks or speaks. */
  onMood?: (mood: JaxMood) => void;
}) {
  const panel = variant === "panel";
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const streaming = draft !== null;
  const mood: JaxMood = streaming ? (draft ? "speaking" : "thinking") : "idle";

  useEffect(() => onMood?.(mood), [mood, onMood]);

  // Keep the newest content in view while the answer streams in.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
    else bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
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

  const conversation = (
    <div className={`flex flex-col gap-6 ${panel ? "" : "flex-1"}`} aria-live="polite">
      {messages.length === 0 && !streaming && (
        <div className="flex animate-rise flex-col items-start gap-5 py-2">
          <div className="flex flex-col gap-2">
            <h2 className={`m-0 tracking-[-0.015em] ${panel ? "text-[17px]" : "text-[20px]"}`}>
              Pregúntame por tu día, tus exámenes o tus apuntes
            </h2>
            <p className="m-0 max-w-xl text-[14px] leading-[1.55] text-neutral-400">
              Leo tus tareas, exámenes, eventos, apuntes y correo. Puedo crear o editar cosas, avisarte a una hora y
              preparar correos que tú envías. Cada cambio se puede deshacer. Lo que me cuentes de ti lo recuerdo; la
              conversación se borra a los 7 días.
            </p>
          </div>
          <ul className={`grid w-full grid-cols-1 gap-2 ${panel ? "" : "sm:grid-cols-2"}`}>
            {SUGGESTIONS.map((s, i) => (
              <li key={s} className="animate-pop" style={{ animationDelay: `${i * 0.05}s` }}>
                <button
                  type="button"
                  onClick={() => void ask(s)}
                  className="flex w-full cursor-pointer items-center gap-[10px] rounded-[14px] bg-surface px-4 py-3 text-left text-[14px] text-neutral-300 transition-[background,color,scale] duration-200 hover:bg-accent-900 hover:text-text active:scale-[0.98]"
                >
                  <Sparkle size={15} weight="fill" color="var(--color-accent-600)" className="flex-none" />
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
              <p
                className="m-0 max-w-[85%] rounded-[20px] rounded-br-[6px] bg-accent px-4 py-[10px] text-[15px] font-medium whitespace-pre-wrap text-on-accent"
              >
                {m.content}
              </p>
            ) : (
              <>
                <JaxAvatar className="mt-0.5 size-8 flex-none" />
                <div className="min-w-0 flex-1 text-[15.5px] leading-relaxed text-neutral-200">
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
          <JaxAvatar mood={draft ? "speaking" : "thinking"} className="mt-0.5 size-8 flex-none" />
          <div className="min-w-0 flex-1 text-[15.5px] leading-relaxed text-neutral-200">
            {draft ? <Answer content={draft} citations={[]} /> : <Thinking />}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="m-0 animate-fade rounded-[14px] bg-danger-soft px-4 py-3 text-[14px] text-danger">
          {error}
        </p>
      )}
      <div ref={bottom} />
    </div>
  );

  const composer = (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="flex items-end gap-[6px] rounded-[24px] py-[6px] pr-[6px] pl-4"
        style={{
          background: "var(--color-surface)",
          boxShadow: focused ? COMPOSER_SHADOW.focus : COMPOSER_SHADOW.idle,
          transition: "box-shadow .2s",
        }}
      >
        <label htmlFor={`jax-input-${variant}`} className="sr-only">
          Pregunta para Jax
        </label>
        <textarea
          id={`jax-input-${variant}`}
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void ask(input);
            }
          }}
          rows={1}
          maxLength={MAX}
          placeholder="Pregunta a Jax…"
          className="max-h-40 min-h-11 flex-1 resize-none border-0 bg-transparent py-[11px] text-[15.5px] text-text outline-none focus-visible:outline-none [field-sizing:content]"
        />
        {streaming ? (
          <button
            type="button"
            onClick={() => abort.current?.abort()}
            aria-label="Detener respuesta"
            className="grid size-11 flex-none cursor-pointer place-items-center rounded-full bg-text text-bg transition-[scale] duration-200 active:scale-[0.88]"
          >
            <Stop size={16} weight="fill" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="Enviar"
            className="grid size-11 flex-none cursor-pointer place-items-center rounded-full active:scale-[0.88] disabled:cursor-not-allowed disabled:opacity-100"
            style={{
              background: input.trim() ? "var(--color-accent)" : "var(--color-step)",
              color: input.trim() ? "var(--color-on-accent)" : "var(--color-neutral-600)",
              transition: "background .2s, color .2s, scale .2s cubic-bezier(.34,1.8,.5,1)",
            }}
          >
            <ArrowUp size={18} />
          </button>
        )}
      </form>
      <div className="flex min-h-[30px] items-center justify-between gap-3 px-2">
        <p className="m-0 text-[12px] text-neutral-500">Jax puede equivocarse.</p>
        <div className="flex items-center gap-1">
        <MemoryDialog />
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
              <button
                type="button"
                onClick={open}
                className="inline-flex flex-none items-center gap-[6px] rounded-full px-3 py-[5px] text-[12.5px] font-medium whitespace-nowrap text-neutral-400 transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] hover:text-neutral-200"
              >
                <ArrowCounterClockwise size={14} />
                Nueva conversación
              </button>
            )}
          >
            <p className="m-0 text-[14px] text-neutral-300">
              Se borrarán todos los mensajes de esta conversación (no lo que Jax recuerda de ti). No se puede deshacer.
            </p>
          </ActionDialog>
        )}
        </div>
      </div>
    </div>
  );

  if (panel) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-4">
          {conversation}
        </div>
        <div className="px-3 pt-1 pb-2">{composer}</div>
      </div>
    );
  }

  return (
    // -mb cancels <main>'s bottom padding: the composer itself reaches the page end, so
    // scrolling stops at the last message instead of leaving empty space under the composer.
    <div className="-mb-28 flex min-h-[calc(100dvh-96px)] animate-rise flex-col gap-8 md:-mb-[120px]">
      <header className="flex items-center gap-4 md:gap-6">
        <JaxAvatar mood={mood} detail="full" className="size-24 flex-none md:size-32" />
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="m-0 text-[clamp(52px,7vw,88px)] leading-[0.95] font-extrabold tracking-[-0.05em]">Jax</h1>
          <p className="m-0 text-[17px] tracking-[-0.012em] text-neutral-400 md:text-[21px]">
            Tu asistente: conoce tu agenda y tus apuntes.
          </p>
        </div>
      </header>

      {conversation}

      {/* Pinned to the viewport bottom; on mobile its padding clears the 60px tab bar, with no gap. */}
      <div className="sticky bottom-0 -mx-4 bg-bg px-4 pt-3 pb-[calc(68px+env(safe-area-inset-bottom))] md:mx-0 md:px-0 md:pb-6">
        {composer}
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
