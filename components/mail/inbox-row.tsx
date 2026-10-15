"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

/**
 * Messages opened in this session. The message page marks them read in Gmail, but
 * going back restores the cached inbox: this set makes the dot go away right away.
 */
const opened = new Set<string>();
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
function markOpened(id: string) {
  if (opened.has(id)) return;
  opened.add(id);
  listeners.forEach((cb) => cb());
}

export type InboxRowData = {
  id: string;
  fromName: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  hiddenBy: string | null;
};

export function InboxRow({ m }: { m: InboxRowData }) {
  const wasOpened = useSyncExternalStore(subscribe, () => opened.has(m.id), () => false);
  const unread = m.unread && !wasOpened;

  return (
    <Link
      href={`/correo/${m.id}`}
      prefetch={false}
      onClick={() => markOpened(m.id)}
      className="pressable flex gap-3 rounded-[14px] p-[14px] transition-[background] duration-200 hover:bg-[color-mix(in_srgb,var(--color-text)_4%,transparent)]"
      style={{ opacity: m.hiddenBy ? 0.5 : 1 }}
    >
      <span
        aria-hidden
        className="mt-[7px] size-[7px] flex-none rounded-full"
        style={{ background: unread ? "var(--color-accent)" : "transparent" }}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="flex items-baseline gap-3">
          <span className={`min-w-0 flex-1 truncate text-[14.5px] ${unread ? "font-semibold" : "font-medium text-neutral-300"}`}>
            {m.fromName}
          </span>
          <span className="flex-none text-[12px] text-neutral-500 tabular-nums">{m.date}</span>
        </span>
        <span className={`truncate text-[14px] ${unread ? "text-text" : "text-neutral-300"}`}>{m.subject}</span>
        <span className="truncate text-[12.5px] text-neutral-500">{m.hiddenBy ? `Oculto por «${m.hiddenBy}»` : m.snippet}</span>
      </span>
      {unread && <span className="sr-only">Sin leer</span>}
    </Link>
  );
}
