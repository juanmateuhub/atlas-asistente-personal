import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight, BookOpen } from "@phosphor-icons/react/ssr";
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
    <div className="animate-rise">
      <div className="mb-[52px] flex flex-wrap items-end justify-between gap-6">
        <PageHeader title="Universidad" lead="Asignaturas, temas y apuntes." />
        <NewSubjectButton />
      </div>
      <Suspense fallback={<Skeleton />}>
        <Overview />
      </Suspense>
    </div>
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
        icon={<BookOpen size={20} weight="fill" />}
        title="Empieza por tu primera asignatura"
        description="Crea una asignatura y organiza dentro sus temas, apuntes y exámenes."
      />
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="subjects">
        <h2 id="subjects" className="m-0 mb-4 text-[26px] tracking-[-0.035em]">
          Asignaturas
        </h2>
        <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr))]">
          {subjects.map((s, i) => (
            <li key={s.id} className="animate-pop" style={{ animationDelay: `${i * 0.04}s` }}>
              <Link
                href={`/universidad/${s.id}`}
                className="relative flex h-full flex-col gap-7 rounded-[22px] bg-surface p-[22px] hover:-translate-y-[3px] hover:bg-[color-mix(in_srgb,var(--color-surface)_92%,var(--color-accent))] active:scale-[0.98]"
                style={{ transition: "translate .35s cubic-bezier(.34,1.5,.5,1), scale .35s cubic-bezier(.34,1.5,.5,1), background .2s" }}
              >
                <span className="flex items-center justify-between">
                  <span
                    aria-hidden
                    className="grid size-[52px] place-items-center rounded-[16px] bg-accent font-heading text-[24px] font-extrabold text-on-accent"
                  >
                    {s.name.charAt(0).toUpperCase()}
                  </span>
                  <ArrowUpRight size={18} color="var(--color-neutral-500)" />
                </span>
                <span className="flex min-w-0 flex-col gap-[3px]">
                  <span className="truncate font-heading text-[22px] font-bold tracking-[-0.035em]">{s.name}</span>
                  <span className="flex flex-wrap gap-x-2 text-[13px] text-neutral-500">
                    <span>{s.topicCount === 1 ? "1 tema" : `${s.topicCount} temas`}</span>
                    {s.nextExam && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="font-medium text-accent-ink">
                          Examen {examCountdown(s.nextExam.date, today).toLowerCase()}
                        </span>
                      </>
                    )}
                  </span>
                  {s.description && (
                    <span className="mt-1 line-clamp-2 text-[13px] leading-[1.45] text-neutral-500">{s.description}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {exams.length > 0 && (
        <section aria-labelledby="upcoming-exams">
          <h2 id="upcoming-exams" className="m-0 mb-3 text-[26px] tracking-[-0.035em]">
            Próximos exámenes
          </h2>
          <ul className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
            {exams.map((exam) => (
              <li key={exam.id}>
                <Link href={`/universidad/${exam.subjectId}`} className="pressable block">
                  <ExamRow exam={exam} today={today} subtitle={exam.subjectName} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr))]">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[168px] animate-skeleton rounded-[22px] bg-step" />
      ))}
    </div>
  );
}
