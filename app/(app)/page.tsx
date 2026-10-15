import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight, CaretRight, FileText, MoonStars, Plus, Sun, SunHorizon } from "@phosphor-icons/react/ssr";
import { Suspense } from "react";
import { TodayTasks } from "@/components/home/today-tasks";
import { Spotlight } from "@/components/ui/spotlight";
import { spotGradient } from "@/lib/ui/spot";
import { ExamRow } from "@/components/university/exam-row";
import { countDay, daySentence, formatLongDate, greeting, hourIn } from "@/lib/home/summary";
import { todayIn } from "@/lib/tasks/dates";
import { listOpenTasksDueBy } from "@/lib/tasks/queries";
import { editedAgo } from "@/lib/university/format";
import { listRecentPages, listUpcomingExams } from "@/lib/university/queries";

const rise = (delay = 0) => `atlasRise .7s ${delay}s cubic-bezier(.2,.8,.2,1) both`;

const TIME_ICON = { "Buenos días": SunHorizon, "Buenas tardes": Sun, "Buenas noches": MoonStars } as const;

const CARD_SHADOW =
  "inset 0 1px 0 color-mix(in srgb, var(--color-text) 8%, transparent), 0 0 0 1px color-mix(in srgb, var(--color-text) 5%, transparent), 0 24px 60px rgba(0,0,0,.38)";

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
  const hello = greeting(hourIn(now));
  const TimeIcon = TIME_ICON[hello as keyof typeof TIME_ICON] ?? Sun;

  return (
    <div className="flex flex-col">
      <header className="mb-9" style={{ animation: rise() }}>
        <p className="flex items-center gap-2 text-[13px] font-medium tracking-[0.02em] text-neutral-500">
          <TimeIcon weight="fill" size={15} color="var(--color-accent-300)" />
          {formatLongDate(today)}
        </p>
        <h1 className="my-[14px] text-[clamp(44px,6vw,68px)] leading-[1.02] tracking-[-0.04em]">{hello}</h1>
        <p className="m-0 text-[21px] tracking-[-0.012em] text-neutral-400">{daySentence(counts)}</p>
      </header>

      <div className="grid items-start gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))]">
        <section aria-labelledby="home-tasks" className="flex flex-col gap-[14px]" style={{ animation: rise(0.08) }}>
          <SectionHeading id="home-tasks" title="Para hoy" href="/tareas" linkLabel="Ver todas las tareas" />
          <Spotlight
            className="relative flex flex-col gap-[14px] rounded-[20px] px-6 py-[26px]"
            style={{
              background: `${spotGradient(320, 11)}, linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 92%, transparent), color-mix(in srgb, var(--color-surface) 55%, transparent))`,
              boxShadow: CARD_SHADOW,
            }}
          >
            <TodayTasks
              tasks={tasks}
              today={today}
              empty={
                <>
                  <div
                    className="grid size-[42px] place-items-center rounded-[13px]"
                    style={{
                      background: "radial-gradient(circle at 50% 0%, var(--color-accent-800), var(--color-accent-900))",
                      boxShadow:
                        "0 0 0 1px var(--color-accent-800), 0 0 22px color-mix(in srgb, var(--color-accent) 22%, transparent)",
                    }}
                  >
                    <TimeIcon weight="fill" size={20} color="var(--color-accent-300)" />
                  </div>
                  <p className="m-0 text-[15px] leading-[1.5] text-neutral-300">No tienes tareas para hoy ni atrasadas.</p>
                  <Link
                    href="/tareas"
                    className="inline-flex items-center gap-[6px] self-start text-[14px] font-medium text-accent-300 hover:text-accent-200"
                  >
                    <Plus size={14} />
                    Añadir una tarea
                  </Link>
                </>
              }
            />
          </Spotlight>
        </section>

        <div className="flex flex-col gap-10" style={{ animation: rise(0.16) }}>
          <section aria-labelledby="home-exams" className="flex flex-col gap-3">
            <SectionHeading id="home-exams" title="Exámenes" href="/calendario" linkLabel="Ir al calendario" />
            {exams.length === 0 ? (
              <p className="m-0 text-[15px] text-neutral-500">Sin exámenes próximos.</p>
            ) : (
              <ul className="flex flex-col">
                {exams.map((exam, i) => (
                  <li key={exam.id} className="animate-pop" style={{ animationDelay: `${0.2 + i * 0.05}s` }}>
                    <Link href={`/universidad/${exam.subjectId}`} className="pressable block">
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
              <p className="m-0 text-[15px] text-neutral-500">Los apuntes que edites aparecerán aquí.</p>
            ) : (
              <ul className="flex flex-col">
                {pages.map((page) => (
                  <li key={page.id}>
                    <Spotlight
                      href={`/universidad/${page.subjectId}/paginas/${page.id}`}
                      className="mx-[-12px] flex items-center gap-[14px] rounded-[16px] p-3 transition-[scale] duration-200 active:scale-[0.985]"
                      style={{ background: spotGradient(220, 10, 300) }}
                    >
                      <span
                        className="grid size-[42px] flex-none place-items-center rounded-[12px] bg-surface"
                        style={{ boxShadow: "0 0 0 1px color-mix(in srgb, var(--color-text) 8%, transparent)" }}
                      >
                        <FileText size={20} color="var(--color-accent-300)" />
                      </span>
                      <span className="flex min-w-0 flex-col gap-[2px]">
                        <span className="truncate text-[15px] font-medium">{page.title}</span>
                        <span className="flex gap-2 text-[12.5px] whitespace-nowrap text-neutral-500">
                          <span className="truncate">{page.subjectName}</span>
                          <span aria-hidden>·</span>
                          <span className="shrink-0">Editado {editedAgo(page.updatedAt, now)}</span>
                        </span>
                      </span>
                      <CaretRight size={14} color="var(--color-neutral-600)" className="ml-auto flex-none" />
                    </Spotlight>
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
      <h2 id={id} className="m-0 text-[20px] tracking-[-0.015em]">
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          aria-label={linkLabel}
          title={linkLabel}
          className="pressable grid size-[30px] place-items-center rounded-full text-neutral-500 transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] hover:text-neutral-300"
        >
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      <div className="mb-9 flex flex-col gap-[14px]">
        <div className="h-4 w-48 animate-skeleton rounded bg-surface/60" />
        <div className="h-16 w-80 max-w-full animate-skeleton rounded-[14px] bg-surface/60" />
        <div className="h-6 w-2/3 animate-skeleton rounded bg-surface/60" />
      </div>
      <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))]">
        <div className="h-56 animate-skeleton rounded-[20px] bg-surface/60" />
        <div className="h-56 animate-skeleton rounded-[20px] bg-surface/60" />
      </div>
    </div>
  );
}
