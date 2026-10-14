import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { BookOpen } from "lucide-react";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ExamRow } from "@/components/university/exam-row";
import { NewSubjectButton } from "@/components/university/new-subject-button";
import { todayIn } from "@/lib/tasks/dates";
import { examCountdown } from "@/lib/university/format";
import { listSubjects, listUpcomingExams } from "@/lib/university/queries";

export const metadata: Metadata = { title: "Universidad" };

export default function UniversidadPage() {
  return (
    <>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <PageHeader title="Universidad" lead="Asignaturas, temas y apuntes." />
        <div className="shrink-0">
          <NewSubjectButton />
        </div>
      </div>
      <Suspense fallback={<Skeleton />}>
        <Overview />
      </Suspense>
    </>
  );
}

async function Overview() {
  // "today" depends on the request time, not the build.
  await connection();
  const today = todayIn(new Date());
  const [subjects, exams] = await Promise.all([listSubjects(today), listUpcomingExams(today, 4)]);

  if (subjects.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Empieza por tu primera asignatura"
        description="Crea una asignatura y organiza dentro sus temas, apuntes y exámenes."
      />
    );
  }

  return (
    <div className="flex flex-col gap-12">
      {exams.length > 0 && (
        <section aria-labelledby="upcoming-exams" className="flex flex-col gap-3">
          <h2 id="upcoming-exams" className="text-lead font-medium">
            Próximos exámenes
          </h2>
          <ul className="grid grid-cols-1 gap-1 md:grid-cols-2">
            {exams.map((exam) => (
              <li key={exam.id}>
                <Link href={`/universidad/${exam.subjectId}`} className="pressable block rounded-atlas">
                  <ExamRow exam={exam} today={today} subtitle={exam.subjectName} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="subjects" className="flex flex-col gap-3">
        <h2 id="subjects" className="text-lead font-medium">
          Asignaturas
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {subjects.map((s) => (
            <li key={s.id}>
              <Link
                href={`/universidad/${s.id}`}
                className="pressable flex h-full items-start gap-4 rounded-atlas border border-line p-5 hover:border-accent"
              >
                <span
                  aria-hidden
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-line/30 text-lead font-bold text-accent"
                >
                  {s.name.charAt(0).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-base font-medium text-ink">{s.name}</span>
                  <span className="flex flex-wrap gap-x-3 text-xs text-muted">
                    <span>{s.topicCount === 1 ? "1 tema" : `${s.topicCount} temas`}</span>
                    {s.nextExam && (
                      <span className="font-medium text-accent">
                        Examen {examCountdown(s.nextExam.date, today).toLowerCase()}
                      </span>
                    )}
                  </span>
                  {s.description && <span className="line-clamp-2 text-sm text-muted">{s.description}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-24 animate-skeleton rounded-atlas bg-line/20" />
      ))}
    </div>
  );
}
