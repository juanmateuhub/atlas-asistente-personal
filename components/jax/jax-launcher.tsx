"use client";

import { ArrowsOut, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { JaxAvatar, type JaxMood } from "./jax-avatar";
import { JaxChat, type JaxChatMessage } from "./jax-chat";

type Load = { state: "idle" | "loading" } | { state: "ready"; messages: JaxChatMessage[] } | { state: "error"; message: string };

const PANEL_SHADOW =
  "inset 0 1px 0 color-mix(in srgb, var(--color-text) 9%, transparent), 0 0 0 1px color-mix(in srgb, var(--color-text) 8%, transparent), 0 0 40px color-mix(in srgb, var(--color-accent) 14%, transparent), 0 30px 80px rgba(0,0,0,.6)";

/**
 * Jax from any screen: an animated avatar fixed top-right that opens a dropdown
 * with the conversation. The panel stays mounted once opened, so an answer keeps
 * streaming if it is closed. Hidden on /jax, which already is the full chat.
 */
export function JaxLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [load, setLoad] = useState<Load>({ state: "idle" });
  const [mood, setMood] = useState<JaxMood>("idle");
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const onJaxPage = pathname?.startsWith("/jax") ?? false;

  const fetchConversation = useCallback(async () => {
    setLoad({ state: "loading" });
    try {
      const res = await fetch("/api/jax", { cache: "no-store" });
      const body = (await res.json()) as { messages?: JaxChatMessage[]; error?: string };
      if (!res.ok || !body.messages) throw new Error(body.error ?? "No se ha podido cargar la conversación.");
      setLoad({ state: "ready", messages: body.messages });
    } catch (err) {
      setLoad({ state: "error", message: err instanceof Error ? err.message : "No se ha podido cargar la conversación." });
    }
  }, []);

  function toggle() {
    if (!open && load.state !== "ready" && load.state !== "loading") void fetchConversation();
    setOpen((o) => !o);
  }

  // Close on navigation (e.g. a citation link inside the panel).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Esc and clicks outside close it. Dialogs opened from the panel live in the top layer: ignore those clicks.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (root.current?.contains(target) || (target as Element).closest?.("dialog")) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  if (onJaxPage) return null;

  return (
    <div ref={root}>
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="jax-panel"
        aria-label={open ? "Cerrar Jax" : "Abrir Jax"}
        title="Jax"
        className="fixed top-[calc(max(env(safe-area-inset-top),16px)-5px)] right-4 z-30 grid size-10 cursor-pointer place-items-center rounded-full transition-[scale] duration-200 active:scale-90 md:top-6 md:right-8 md:size-12"
        style={{
          background: "radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--color-accent) 22%, var(--color-surface)), var(--color-surface) 70%)",
          boxShadow: open
            ? "0 0 0 1px color-mix(in srgb, var(--color-accent) 70%, transparent), 0 0 0 5px color-mix(in srgb, var(--color-accent) 14%, transparent), 0 0 28px color-mix(in srgb, var(--color-accent) 40%, transparent)"
            : "0 0 0 1px color-mix(in srgb, var(--color-text) 10%, transparent), 0 0 22px color-mix(in srgb, var(--color-accent) 25%, transparent), 0 10px 26px rgba(0,0,0,.45)",
          transitionTimingFunction: "cubic-bezier(.34,1.8,.5,1)",
        }}
      >
        <JaxAvatar mood={mood} detail="full" className="size-9 md:size-11" />
      </button>

      <section
        id="jax-panel"
        aria-label="Jax"
        inert={!open}
        className="fixed top-[calc(max(env(safe-area-inset-top),16px)+44px)] right-2 bottom-[calc(68px+env(safe-area-inset-bottom))] left-2 z-30 flex flex-col overflow-hidden rounded-[22px] md:top-[84px] md:right-8 md:bottom-auto md:left-auto md:h-[min(640px,calc(100dvh-110px))] md:w-[420px]"
        style={{
          background: "color-mix(in srgb, var(--color-bg) 88%, var(--color-surface))",
          backdropFilter: "blur(28px) saturate(140%)",
          boxShadow: PANEL_SHADOW,
          transformOrigin: "top right",
          opacity: open ? 1 : 0,
          transform: open ? "none" : "scale(.94) translateY(-8px)",
          pointerEvents: open ? "auto" : "none",
          visibility: open ? "visible" : "hidden",
          transition: open
            ? "opacity .25s cubic-bezier(.2,.8,.2,1), transform .4s cubic-bezier(.34,1.45,.5,1), visibility 0s"
            : "opacity .2s, transform .25s, visibility 0s .25s",
        }}
      >
        <header className="flex flex-none items-center gap-3 px-4 pt-4 pb-2">
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-medium tracking-[-0.01em]">Jax</span>
            <span className="block truncate text-[12.5px] text-neutral-500">Conoce tu agenda y tus apuntes</span>
          </span>
          <Link
            href="/jax"
            aria-label="Abrir Jax en pantalla completa"
            title="Pantalla completa"
            className="pressable grid size-[34px] place-items-center rounded-full text-neutral-400 transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] hover:text-neutral-200"
          >
            <ArrowsOut size={16} />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar Jax"
            className="pressable grid size-[34px] place-items-center rounded-full text-neutral-400 transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] hover:text-neutral-200"
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1">
          {load.state === "ready" && <JaxChat initialMessages={load.messages} variant="panel" onMood={setMood} />}
          {(load.state === "loading" || load.state === "idle") && (
            <div aria-hidden className="flex flex-col gap-3 p-4">
              <div className="h-10 w-2/3 self-end animate-skeleton rounded-[18px] bg-surface/70" />
              <div className="h-16 w-5/6 animate-skeleton rounded-[18px] bg-surface/70" />
            </div>
          )}
          {load.state === "error" && (
            <div className="flex flex-col items-start gap-3 p-4">
              <p role="alert" className="m-0 text-[14px] text-neutral-300">
                {load.message}
              </p>
              <button
                type="button"
                onClick={() => void fetchConversation()}
                className="rounded-full px-3 py-[5px] text-[13px] font-medium text-accent hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
