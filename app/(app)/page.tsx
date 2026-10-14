import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight, FileText } from "lucide-react";
import { Suspense } from "react";
import { TodayTasks } from "@/components/home/today-tasks";
import { ExamRow } from "@/components/university/exam-row";
import { countDay, daySentence, formatLongDate, greeting, hourIn } from "@/lib/home/summary";
import { todayIn } from "@/lib/tasks/dates";
import { listOpenTasksDueBy } from "@/lib/tasks/queries";
import { editedAgo } from "@/lib/university/format";
import { listRecentPages, listUpcomingExams } from "@/lib/university/queries";

export default function InicioPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  // Everything here depends on "now": render per request.
  await connection();
  const now = new Date();
  const today = todayIn(now);

  // Inicio derives from the modules; it stores nothing of its own.
  const [tasks, exams, pages] = await Promise.all([
    listOpenTasksDueBy(today),
    listUpcomingExams(today, 3),
    listRecentPages(4),
  ]);
  const counts = countDay(tasks, exams, today);

  return (
    <>
      <header className="flex flex-col gap-3">
        <p className="text-base text-muted">{formatLongDate(today)}</p>
        <h1 className="text-title font-bold md:text-display">{greeting(hourIn(now))}</h1>
        <p className="max-w-2xl text-lead font-medium text-body">{daySentence(counts)}</p>
      </header>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="home-tasks" className="flex flex-col gap-3">
          <SectionHeading id="home-tasks" title="Para hoy" href="/tareas" linkLabel="Ver todas las tareas" />
          {tasks.length === 0 ? (
            <p className="rounded-atlas bg-line/15 px-5 py-6 text-base text-muted">
              No tienes tareas para hoy ni atrasadas.{" "}
              <Link href="/tareas" className="font-medium text-accent">
                Añadir una tarea
              </Link>
            </p>
          ) : (
            <TodayTasks tasks={tasks} today={today} />
          )}
        </section>

        <div className="flex flex-col gap-12">
          <section aria-labelledby="home-exams" className="flex flex-col gap-3">
            <SectionHeading id="home-exams" title="Exámenes" href="/universidad" linkLabel="Ir a Universidad" />
            {exams.length === 0 ? (
              <p className="text-base text-muted">Sin exámenes próximos.</p>
            ) : (
              <ul className="flex flex-col">
                {exams.map((exam) => (
                  <li key={exam.id}>
                    <Link href={`/universidad/${exam.subjectId}`} className="pressable block rounded-atlas">
                      <ExamRow exam={exam} today={today} subtitle={exam.subjectName} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="home-notes" className="flex flex-col gap-3">
            <SectionHeading id="home-notes" title="Seguir con tus apuntes" />
            {pages.length === 0 ? (
              <p className="text-base text-muted">Los apuntes que edites aparecerán aquí.</p>
            ) : (
              <ul className="flex flex-col">
                {pages.map((page) => (
                  <li key={page.id}>
                    <Link
                      href={`/universidad/${page.subjectId}/paginas/${page.id}`}
                      className="pressable flex items-center gap-3 rounded-atlas px-3 py-3 hover:bg-line/15"
                    >
                      <FileText aria-hidden className="size-5 shrink-0 text-accent" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-base text-ink">{page.title}</span>
                        <span className="flex gap-3 text-xs text-muted">
                          <span className="truncate">{page.subjectName}</span>
                          <span className="shrink-0">Editado {editedAgo(page.updatedAt, now)}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function SectionHeading({
  id,
  title,
  href,
  linkLabel,
}: {
  id: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 id={id} className="text-lead font-medium">
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          aria-label={linkLabel}
          title={linkLabel}
          className="pressable flex size-10 items-center justify-center rounded-atlas text-muted hover:bg-line/30 hover:text-ink"
        >
          <ArrowUpRight aria-hidden className="size-5" />
        </Link>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="h-5 w-48 animate-skeleton rounded-atlas bg-line/20" />
        <div className="h-14 w-72 animate-skeleton rounded-atlas bg-line/20" />
        <div className="h-8 w-2/3 animate-skeleton rounded-atlas bg-line/20" />
      </div>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[3fr_2fr]">
        <div className="h-56 animate-skeleton rounded-atlas bg-line/20" />
        <div className="h-56 animate-skeleton rounded-atlas bg-line/20" />
      </div>
    </div>
  );
}
