import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight, Barbell, Play, Plus } from "@phosphor-icons/react/ssr";
import { Suspense } from "react";
import { CoachCard } from "@/components/fitness/coach-card";
import { MusclePanel } from "@/components/fitness/muscle-panel";
import { NewRoutineButton } from "@/components/fitness/new-routine-button";
import { RecordsGrid } from "@/components/fitness/records-grid";
import { WeightCard } from "@/components/fitness/weight-card";
import { PageHeader } from "@/components/ui/page-header";
import { exerciseKey, guessMuscles, muscleVolume } from "@/lib/fitness/muscles";
import {
  latestCoachNote,
  listBodyWeights,
  listMuscleOverrides,
  listRoutines,
  listWorkouts,
} from "@/lib/fitness/queries";
import {
  exerciseHistory,
  exerciseNames,
  formatKg,
  personalRecords,
  summarize,
  volume,
} from "@/lib/fitness/stats";
import { daysBetween, todayIn } from "@/lib/tasks/dates";
import { startWorkout } from "./actions";

export const metadata: Metadata = { title: "Fitness" };

const longDate = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function dayLabel(date: string, today: string) {
  const diff = daysBetween(today, date);
  if (diff === 0) return "Hoy";
  if (diff === -1) return "Ayer";
  const [y, m, d] = date.split("-").map(Number);
  const s = longDate.format(new Date(Date.UTC(y, m - 1, d)));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function FitnessPage() {
  return (
    <div className="animate-rise">
      <div className="mb-[52px] flex flex-wrap items-end justify-between gap-6">
        <PageHeader title="Fitness" lead="Entrenos, rutinas y tu peso." />
        <form action={startWorkout}>
          <button
            type="submit"
            className="pressable inline-flex h-[44px] flex-none cursor-pointer items-center gap-[6px] rounded-full bg-accent px-5 text-[15px] font-semibold whitespace-nowrap text-on-accent transition-[background,scale] hover:bg-accent-500"
          >
            <Plus size={16} weight="bold" />
            Nuevo entreno
          </button>
        </form>
      </div>
      <Suspense fallback={<Skeleton />}>
        <Overview />
      </Suspense>
    </div>
  );
}

async function Overview() {
  await connection();
  const today = todayIn(new Date());
  const [workouts, routines, weights, overrides, note] = await Promise.all([
    listWorkouts(),
    listRoutines(),
    listBodyWeights(),
    listMuscleOverrides(),
    latestCoachNote(),
  ]);
  const exercises = exerciseNames(workouts, routines).map((name) => {
    const key = exerciseKey(name);
    const custom = overrides[key];
    const has = (w: { exercises: { name: string }[] }) => w.exercises.some((e) => exerciseKey(e.name) === key);
    return {
      name,
      muscles: custom ?? guessMuscles(name),
      custom: !!custom,
      workouts: workouts.filter(has).length,
      routines: routines.filter(has).length,
    };
  });
  const records = personalRecords(workouts, 6);
  const history = Object.fromEntries(
    records.map((r) => [r.name, exerciseHistory(workouts, r.name)]),
  );
  const weekAgo = workouts.filter(
    (w) => daysBetween(w.date, today) < 7 && daysBetween(w.date, today) >= 0,
  ).length;

  return (
    <div className="flex flex-col gap-12">
      <MusclePanel
        week={muscleVolume(workouts, overrides, today, 7)}
        month={muscleVolume(workouts, overrides, today, 28)}
        exercises={exercises}
      />
      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <div className="flex min-w-0 flex-col gap-12">
          <section aria-labelledby="workouts-title">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2
                id="workouts-title"
                className="m-0 text-[26px] tracking-[-0.035em]"
              >
                Entrenos
              </h2>
              {workouts.length > 0 && (
                <p className="m-0 text-[13px] text-neutral-500">
                  {weekAgo === 0
                    ? "Ninguno esta semana"
                    : weekAgo === 1
                      ? "1 en los últimos 7 días"
                      : `${weekAgo} en los últimos 7 días`}
                </p>
              )}
            </div>
            {workouts.length === 0 ? (
              <div className="flex flex-col items-start gap-[14px] rounded-[22px] bg-surface px-6 py-[26px]">
                <span
                  aria-hidden
                  className="grid size-[44px] place-items-center rounded-[14px] bg-accent text-on-accent"
                >
                  <Barbell size={22} weight="fill" />
                </span>
                <p className="m-0 font-heading text-[22px] font-bold tracking-[-0.035em]">
                  Tu primer entreno
                </p>
                <p className="m-0 max-w-md text-[15px] leading-[1.5] text-neutral-400">
                  Pulsa «Nuevo entreno» y apunta ejercicios, series,
                  repeticiones y peso. También puedes decírselo a Jax: «apunta
                  press banca 3×8 a 60 kg».
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {workouts.slice(0, 20).map((w, i) => (
                  <li
                    key={w.id}
                    className="animate-pop"
                    style={{ animationDelay: `${Math.min(i, 10) * 0.03}s` }}
                  >
                    <Link
                      href={`/fitness/entrenos/${w.id}`}
                      className="pressable group flex items-center gap-4 rounded-[18px] bg-surface px-[18px] py-[14px] transition-[background] hover:bg-[color-mix(in_srgb,var(--color-surface)_92%,var(--color-accent))]"
                    >
                      <span className="w-[86px] flex-none text-[13px] font-medium text-neutral-500">
                        {dayLabel(w.date, today)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                        <span className="truncate text-[15.5px] font-semibold">
                          {w.title}
                        </span>
                        <span className="truncate text-[12.5px] text-neutral-500">
                          {w.exercises.length
                            ? w.exercises.map((e) => e.name).join(", ")
                            : "Sin ejercicios"}
                        </span>
                      </span>
                      <span className="hidden flex-none flex-col items-end gap-[2px] text-[12.5px] text-neutral-500 tabular-nums sm:flex">
                        <span>{summarize(w.exercises)}</span>
                        {volume(w.exercises) > 0 && (
                          <span>{formatKg(volume(w.exercises))}</span>
                        )}
                      </span>
                      <ArrowUpRight
                        size={16}
                        color="var(--color-neutral-500)"
                        className="flex-none"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {records.length > 0 && (
            <RecordsGrid records={records} history={history} />
          )}
        </div>

        <div className="flex flex-col gap-12">
          <CoachCard note={note} />
          <WeightCard weights={weights} today={today} />

          <section aria-labelledby="routines-title">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2
                id="routines-title"
                className="m-0 text-[26px] tracking-[-0.035em]"
              >
                Rutinas
              </h2>
              <NewRoutineButton />
            </div>
            {routines.length === 0 ? (
              <p className="m-0 rounded-[20px] bg-surface p-[22px] text-[15px] leading-[1.55] text-neutral-400">
                Crea una rutina (p. ej. Torso o Pierna) para empezar entrenos
                con los ejercicios ya puestos.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {routines.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-2 rounded-[18px] bg-surface py-2 pr-2 pl-[18px]"
                  >
                    <Link
                      href={`/fitness/rutinas/${r.id}`}
                      className="flex min-w-0 flex-1 flex-col gap-[2px] py-[6px]"
                    >
                      <span className="truncate text-[15.5px] font-semibold hover:underline">
                        {r.name}
                      </span>
                      <span className="truncate text-[12.5px] text-neutral-500">
                        {summarize(r.exercises)}
                      </span>
                    </Link>
                    <form action={startWorkout}>
                      <input type="hidden" name="routineId" value={r.id} />
                      <button
                        type="submit"
                        aria-label={`Empezar entreno de ${r.name}`}
                        className="pressable inline-flex h-[36px] items-center gap-[6px] rounded-full bg-step px-[14px] text-[13.5px] font-medium transition-[background,scale] hover:bg-neutral-800"
                      >
                        <Play size={13} weight="fill" />
                        Empezar
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div
      aria-hidden
      className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]"
    >
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[68px] animate-skeleton rounded-[18px] bg-step"
          />
        ))}
      </div>
      <div className="h-[280px] animate-skeleton rounded-[22px] bg-step" />
    </div>
  );
}
