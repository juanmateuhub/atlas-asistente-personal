import { notFound } from "next/navigation";
import { Play } from "@phosphor-icons/react/ssr";
import { Suspense } from "react";
import { WorkoutActions, WorkoutForm } from "@/components/fitness/workout-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { primaryButtonClass } from "@/components/ui/form";
import { getRoutine, listRoutines, listWorkouts } from "@/lib/fitness/queries";
import { exerciseNames } from "@/lib/fitness/stats";
import { parseTaskId as parseId } from "@/lib/tasks/validation";
import { startWorkout } from "../../actions";

export default function RoutinePage({ params }: PageProps<"/fitness/rutinas/[routineId]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <RoutineDetail params={params} />
    </Suspense>
  );
}

async function RoutineDetail({ params }: Pick<PageProps<"/fitness/rutinas/[routineId]">, "params">) {
  const id = parseId((await params).routineId);
  if (!id) notFound();
  const [routine, workouts, routines] = await Promise.all([getRoutine(id), listWorkouts(), listRoutines()]);
  if (!routine) notFound();

  return (
    <div className="flex animate-rise flex-col gap-8">
      <title>{`${routine.name} · Atlas`}</title>
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ href: "/fitness", label: "Fitness" }, { label: "Rutinas" }, { label: routine.name }]} />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h1 className="m-0 text-[clamp(40px,6vw,72px)] leading-[0.95] font-extrabold tracking-[-0.05em]">{routine.name}</h1>
          <div className="flex flex-wrap gap-2">
            <WorkoutActions kind="routine" routine={routine} />
            <form action={startWorkout}>
              <input type="hidden" name="routineId" value={routine.id} />
              <button type="submit" className={primaryButtonClass}>
                <Play size={14} weight="fill" />
                Empezar entreno
              </button>
            </form>
          </div>
        </div>
        <p className="m-0 max-w-2xl text-[15px] text-neutral-400">
          Las series de la rutina son tu objetivo: al empezar un entreno se copian y ahí apuntas lo que hagas de verdad.
        </p>
      </div>
      <WorkoutForm key={routine.id} kind="routine" routine={routine} suggestions={exerciseNames(workouts, routines)} />
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8">
      <div className="h-16 w-2/3 animate-skeleton rounded-[18px] bg-step" />
      <div className="h-64 animate-skeleton rounded-[22px] bg-step" />
    </div>
  );
}
