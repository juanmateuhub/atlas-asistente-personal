"use client";

import { Bell, BellRinging, BellSlash } from "@phosphor-icons/react";
import { useEffect, useState, useTransition } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/(app)/recordatorios/actions";
import { useToast } from "@/components/ui/toast";

type State = "loading" | "unsupported" | "install" | "denied" | "off" | "on";

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

/**
 * Turns this device's notifications on or off (reminders and what Jax finds in
 * the mail). iPhone only allows them once Atlas is on the home screen.
 */
export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && Boolean(key);
      let next: State;
      if (!supported) next = isIos() && !standalone() ? "install" : "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else {
        const sub = await (await registration()).pushManager.getSubscription().catch(() => null);
        next = sub ? "on" : "off";
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  function enable() {
    startTransition(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      try {
        const reg = await registration();
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(key!) });
        const result = await savePushSubscription(JSON.parse(JSON.stringify(sub)));
        if (result.error) {
          toast(result.error);
          return;
        }
        setState("on");
        await sendTestPush();
      } catch {
        toast("No se han podido activar los avisos en este navegador.");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      toast("Avisos desactivados en este dispositivo");
    });
  }

  if (state === "loading") return <span aria-hidden className="block h-9" />;

  if (state === "on") {
    return (
      <button
        type="button"
        onClick={disable}
        disabled={pending}
        title="Pulsa para desactivar los avisos en este dispositivo"
        className="pressable inline-flex h-9 items-center gap-[6px] rounded-full px-3 text-[13px] font-medium whitespace-nowrap text-neutral-400 transition-colors hover:bg-step hover:text-text"
      >
        <BellRinging size={15} weight="fill" color="var(--color-accent-ink)" />
        Avisos activados en este dispositivo
      </button>
    );
  }

  const hint =
    state === "install"
      ? "Para recibir avisos en el iPhone, añade Atlas a la pantalla de inicio."
      : state === "denied"
        ? "Has bloqueado las notificaciones de Atlas en este navegador."
        : state === "unsupported"
          ? "Este navegador no admite avisos."
          : null;

  if (hint) {
    return (
      <span title={hint} className="inline-flex items-center gap-[6px] text-[12.5px] text-neutral-500">
        <BellSlash size={15} />
        <span className="max-w-[26ch] leading-tight">{hint}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={enable}
      disabled={pending}
      className="pressable inline-flex h-9 items-center gap-[6px] rounded-full bg-step px-[14px] text-[13.5px] font-medium whitespace-nowrap text-text transition-[background,scale] hover:bg-neutral-800"
    >
      <Bell size={15} />
      {pending ? "Activando…" : "Activar avisos"}
    </button>
  );
}
