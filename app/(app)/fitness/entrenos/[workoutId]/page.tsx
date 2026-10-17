import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WorkoutActions, WorkoutForm } from "@/components/fitness/workout-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { listMuscleOverrides, listRoutines, listWorkouts } from "@/lib/fitness/queries";
import { exerciseNames, lastPerformance } from "@/lib/fitness/stats";
import { parseTaskId as parseId } from "@/lib/tasks/validation";

export default function WorkoutPage({ params }: PageProps<"/fitness/entrenos/[workoutId]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <WorkoutDetail params={params} />
    </Suspense>
  );
}

async function WorkoutDetail({ params }: Pick<PageProps<"/fitness/entrenos/[workoutId]">, "params">) {
  const id = parseId((await params).workoutId);
  if (!id) notFound();
  // History gives "last time" per exercise and the name suggestions.
  const [workouts, routines, overrides] = await Promise.all([listWorkouts(), listRoutines(), listMuscleOverrides()]);
  const workout = workouts.find((w) => w.id === id);
  if (!workout) notFound();
  // Only sessions before this one count as "last time".
  const earlier = workouts.filter((w) => w.date < workout.date || (w.date === workout.date && w.id !== id));

  return (
    <div className="flex animate-rise flex-col gap-8">
      <title>{`${workout.title} · Atlas`}</title>
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ href: "/fitness", label: "Fitness" }, { label: workout.title }]} />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h1 className="m-0 text-[clamp(40px,6vw,72px)] leading-[0.95] font-extrabold tracking-[-0.05em]">{workout.title}</h1>
          <WorkoutActions kind="workout" workout={workout} routineNames={routines.map((r) => r.name)} />
        </div>
      </div>
      <WorkoutForm
        key={workout.id}
        kind="workout"
        workout={workout}
        suggestions={exerciseNames(workouts, routines)}
        previous={lastPerformance(earlier)}
        overrides={overrides}
      />
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8">
      <div className="h-16 w-2/3 animate-skeleton rounded-[18px] bg-step" />
      <div className="h-40 animate-skeleton rounded-[22px] bg-step" />
      <div className="h-64 animate-skeleton rounded-[22px] bg-step" />
    </div>
  );
}
