"use client";

import { Lightning, Medal, Trophy } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { Dialog } from "@/components/ui/dialog";
import { primaryButtonClass } from "@/components/ui/form";
import type { Reward } from "@/lib/fitness/game";
import { playChime } from "@/lib/ui/sound";

/** Sparks around the level badge (atlasSpark in globals.css), larger than the task check's. */
function Burst() {
  return (
    <span aria-hidden className="pointer-events-none absolute top-1/2 left-1/2">
      {Array.from({ length: 16 }, (_, i) => (
        <span
          key={i}
          className="absolute rounded-[2px]"
          style={
            {
              width: i % 2 ? 6 : 9,
              height: i % 2 ? 6 : 9,
              margin: i % 2 ? -3 : -4.5,
              background: i % 2 ? "var(--color-text)" : "var(--color-accent)",
              "--a": `${i * 22.5}deg`,
              animation: `atlasLevelSpark .9s ${0.1 + (i % 4) * 0.04}s cubic-bezier(.2,.8,.2,1) both`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

/**
 * Shown after saving a workout that earned something worth celebrating: a new
 * level, records or achievements. Plain XP gains only get the toast.
 */
export function RewardDialog({ reward, onClose }: { reward: Reward | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const show = !!reward && (!!reward.levelUp || reward.records.length > 0 || reward.achievements.length > 0);

  // Once per reward (a new object after each save).
  useEffect(() => {
    if (!show || ref.current?.open) return;
    ref.current?.showModal();
    playChime(reward?.levelUp ? "levelup" : "done");
  }, [show, reward, ref]);

  const close = () => {
    ref.current?.close();
    onClose();
  };

  return (
    <Dialog dialogRef={ref} title={reward?.levelUp ? "¡Subes de nivel!" : "¡Bien jugado!"} onClose={close}>
      {reward && (
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="relative grid place-items-center py-2">
            <Burst />
            <span
              className="grid size-[96px] place-items-center rounded-[24px] bg-accent text-on-accent"
              style={{ animation: "atlasPop .6s cubic-bezier(.34,1.8,.5,1) both" }}
            >
              {reward.levelUp ? (
                <span className="flex flex-col items-center leading-none">
                  <span className="font-pixel text-[12px]">NV</span>
                  <span className="font-pixel text-[40px]">{reward.levelUp.level}</span>
                </span>
              ) : (
                <Trophy size={44} weight="fill" />
              )}
            </span>
          </div>
          {reward.levelUp && (
            <p className="m-0 text-[15px] text-neutral-400">
              Ahora eres <strong className="font-heading text-[20px] text-text">{reward.levelUp.title}</strong>
            </p>
          )}
          {reward.xp > 0 && <p className="m-0 font-pixel text-[18px] text-accent-ink">+{reward.xp} XP</p>}
          <ul className="flex w-full flex-col gap-2 text-left">
            {reward.records.map((r) => (
              <li key={`r-${r}`} className="flex items-center gap-3 rounded-[14px] bg-step px-4 py-3 text-[14px]">
                <Trophy size={18} weight="fill" color="var(--color-accent-ink)" />
                <span>
                  Nuevo récord en <strong>{r}</strong>
                </span>
              </li>
            ))}
            {reward.achievements.map((a) => (
              <li key={`a-${a}`} className="flex items-center gap-3 rounded-[14px] bg-step px-4 py-3 text-[14px]">
                <Medal size={18} weight="fill" color="var(--color-accent-ink)" />
                <span>
                  Logro desbloqueado: <strong>{a}</strong>
                </span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={close} className={`${primaryButtonClass} w-full`} autoFocus>
            <Lightning size={16} weight="fill" />
            Seguir
          </button>
        </div>
      )}
    </Dialog>
  );
}
