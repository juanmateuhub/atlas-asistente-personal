import {
  Barbell,
  Brain,
  Check,
  Crown,
  Fire,
  Flame,
  Lightning,
  Lock,
  Medal,
  Mountains,
  Scales,
  ShieldStar,
  Sword,
  Target,
  Trophy,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import { JaxAvatar } from "@/components/jax/jax-avatar";
import type { Achievement, GameState, Quest } from "@/lib/fitness/game";

/** Block-segmented bar, like a game HUD. `tone` dark for the ink card. */
export function PixelBar({
  value,
  max,
  segments = 20,
  tone = "dark",
  label,
}: {
  value: number;
  max: number;
  segments?: number;
  tone?: "dark" | "light";
  label: string;
}) {
  const filled = max > 0 ? Math.round((Math.min(value, max) / max) * segments) : 0;
  const empty = tone === "dark" ? "var(--color-section-ghost)" : "var(--color-step)";
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className="flex h-3 gap-[3px]"
    >
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className="flex-1 rounded-[2px]"
          style={{
            background: i < filled ? "var(--color-accent)" : empty,
            animation: i < filled ? `atlasFade .25s ${0.2 + i * 0.03}s both` : undefined,
          }}
        />
      ))}
    </div>
  );
}

const STATS = [
  { key: "fuerza", short: "FUE", label: "Fuerza", hint: "Tus 3 mejores 1RM, respecto a tu peso" },
  { key: "resistencia", short: "RES", label: "Resistencia", hint: "Repeticiones en las últimas 4 semanas" },
  { key: "constancia", short: "CON", label: "Constancia", hint: "Días entrenados en las últimas 4 semanas" },
] as const;

/** The character sheet: level, title, XP to the next level, streak and the three attributes. */
export function CharacterCard({ game }: { game: GameState }) {
  const { level, stats, streak } = game;
  return (
    <section
      aria-labelledby="character-title"
      className="grid animate-pop grid-cols-1 gap-6 rounded-[26px] bg-section p-6 text-bg sm:p-7 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:gap-10"
    >
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex items-center gap-5">
          <div className="relative flex-none">
            <span aria-hidden className="grid size-[84px] place-items-center rounded-[22px] bg-accent text-on-accent">
              <Sword size={40} weight="fill" />
            </span>
            <span className="absolute -right-2 -bottom-2 rounded-full bg-bg px-[10px] py-[3px] font-pixel text-[13px] text-text">
              NV {level.level}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-pixel text-[11px] tracking-[0.12em] text-neutral-600 uppercase">Tu personaje</span>
            <h2 id="character-title" className="m-0 truncate font-heading text-[clamp(30px,4vw,40px)] leading-none font-extrabold tracking-[-0.04em] text-bg">
              {level.title}
            </h2>
            <span className="text-[13px] text-neutral-600">Nivel {level.level}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 font-pixel text-[12px]">
            <span className="text-accent">XP</span>
            <span className="tabular-nums text-neutral-700">
              {level.into} / {level.needed}
            </span>
          </div>
          <PixelBar value={level.into} max={level.needed} label={`Experiencia: ${level.into} de ${level.needed} para el nivel ${level.level + 1}`} />
          <span className="text-[12.5px] text-neutral-600">
            Faltan {level.needed - level.into} XP para el nivel {level.level + 1} · {level.xp} XP en total
          </span>
        </div>

        <div className="flex items-center gap-3 rounded-[16px] bg-section-ghost px-4 py-3">
          <Fire size={22} weight="fill" color={streak > 0 ? "var(--color-accent)" : "var(--color-neutral-500)"} />
          <span className="font-pixel text-[20px] leading-none tabular-nums">{streak}</span>
          <span className="text-[13px] text-neutral-700">
            {streak === 1 ? "semana de racha" : "semanas de racha"}
            {streak === 0 && " · entrena esta semana para empezarla"}
          </span>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-4">
        <span className="font-pixel text-[11px] tracking-[0.12em] text-neutral-600 uppercase">Atributos</span>
        {STATS.map((s) => (
          <div key={s.key} className="flex flex-col gap-[6px]" title={s.hint}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-baseline gap-2">
                <span className="font-pixel text-[13px] text-accent">{s.short}</span>
                <span className="text-[13px] text-neutral-700">{s.label}</span>
              </span>
              <span className="font-pixel text-[15px] tabular-nums">{stats[s.key]}</span>
            </div>
            <PixelBar value={stats[s.key]} max={99} segments={14} label={`${s.label}: ${stats[s.key]} de 99`} />
          </div>
        ))}
      </div>
    </section>
  );
}

function jaxLine(quests: Quest[]): string {
  const pending = quests.filter((q) => !q.done);
  if (pending.length === 0) return "Misiones de la semana cumplidas. El lunes te traigo más.";
  const train = quests.find((q) => q.id === "entrenos");
  if (train && !train.done) {
    const left = train.goal - train.progress;
    return left === train.goal
      ? "Una semana nueva, aventurero. Entrena tres días y la recompensa es tuya."
      : `Te ${left === 1 ? "queda 1 día" : `quedan ${left} días`} de entreno para cumplir la misión principal.`;
  }
  return "Buen ritmo. Remata las misiones que quedan antes del domingo.";
}

/** Weekly quests, handed out by Jax. */
export function QuestsCard({ quests }: { quests: Quest[] }) {
  const done = quests.filter((q) => q.done).length;
  return (
    <section aria-labelledby="quests-title" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="quests-title" className="m-0 text-[26px] tracking-[-0.035em]">
          Misiones de la semana
        </h2>
        <span className="font-pixel text-[12px] text-neutral-500 tabular-nums">
          {done}/{quests.length}
        </span>
      </div>
      <div className="flex flex-col gap-4 rounded-[22px] bg-surface p-[18px] sm:p-[22px]">
        <div className="flex items-start gap-3">
          <JaxAvatar className="size-10 flex-none" />
          <p className="m-0 rounded-[16px] rounded-tl-[4px] bg-step px-4 py-3 text-[14px] leading-[1.45] text-neutral-300">{jaxLine(quests)}</p>
        </div>
        <ul className="flex flex-col gap-2">
          {quests.map((q) => (
            <li key={q.id} className="flex items-center gap-3 rounded-[14px] px-1 py-1">
              <span
                aria-hidden
                className="grid size-[26px] flex-none place-items-center rounded-[7px]"
                style={{
                  background: q.done ? "var(--color-accent)" : "transparent",
                  border: q.done ? "none" : "2px solid var(--color-neutral-700)",
                }}
              >
                {q.done && <Check size={14} weight="bold" color="var(--color-on-accent)" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
                <span className={`text-[14.5px] font-medium ${q.done ? "text-neutral-500 line-through decoration-neutral-600" : ""}`}>
                  {q.title}
                </span>
                {q.goal > 1 && <PixelBar value={q.progress} max={q.goal} segments={q.goal * 4} tone="light" label={`${q.title}: ${q.progress} de ${q.goal}`} />}
              </span>
              <span className="flex-none font-pixel text-[12px] tabular-nums text-neutral-500">
                {q.progress}/{q.goal}
              </span>
              <span
                className="flex-none rounded-full px-[10px] py-[3px] font-pixel text-[11px]"
                style={{ background: q.done ? "var(--color-step)" : "var(--color-accent)", color: q.done ? "var(--color-neutral-500)" : "var(--color-on-accent)" }}
              >
                +{q.xp} XP
              </span>
            </li>
          ))}
        </ul>
        <p className="m-0 text-[12px] text-neutral-500">Se renuevan cada lunes. Cada entreno da XP por series, kilos movidos y récords.</p>
      </div>
    </section>
  );
}

const ACHIEVEMENT_ICON: Record<string, Icon> = {
  "primer-entreno": Sword,
  diez: Barbell,
  cincuenta: ShieldStar,
  cien: Crown,
  record: Trophy,
  "diez-records": Lightning,
  "club-100": Medal,
  toneladas: Mountains,
  "racha-4": Flame,
  "racha-12": Fire,
  estratega: Brain,
  bascula: Scales,
};

export function AchievementsGrid({ achievements }: { achievements: Achievement[] }) {
  const unlocked = achievements.filter((a) => a.unlocked).length;
  // Unlocked first, keeping the list order (easiest to hardest).
  const ordered = [...achievements.filter((a) => a.unlocked), ...achievements.filter((a) => !a.unlocked)];
  return (
    <section aria-labelledby="achievements-title">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id="achievements-title" className="m-0 text-[26px] tracking-[-0.035em]">
          Logros
        </h2>
        <span className="font-pixel text-[12px] text-neutral-500 tabular-nums">
          {unlocked}/{achievements.length}
        </span>
      </div>
      <ul className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(200px,100%),1fr))]">
        {ordered.map((a) => {
          const Icon = ACHIEVEMENT_ICON[a.id] ?? Target;
          return (
            <li
              key={a.id}
              className="flex items-center gap-3 rounded-[18px] p-[14px]"
              style={{ background: a.unlocked ? "var(--color-surface)" : "var(--color-step)" }}
            >
              <span
                aria-hidden
                className="grid size-[42px] flex-none place-items-center rounded-[12px]"
                style={{ background: a.unlocked ? "var(--color-accent)" : "var(--color-neutral-800)" }}
              >
                {a.unlocked ? (
                  <Icon size={20} weight="fill" color="var(--color-on-accent)" />
                ) : (
                  <Lock size={16} weight="bold" color="var(--color-neutral-600)" />
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className={`truncate text-[14px] font-semibold ${a.unlocked ? "" : "text-neutral-500"}`}>{a.title}</span>
                <span className="text-[12px] leading-[1.35] text-neutral-500">{a.description}</span>
              </span>
              <span className="sr-only">{a.unlocked ? "Desbloqueado" : "Bloqueado"}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
