import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight, CaretRight, FileText, MoonStars, Plus, Sun, SunHorizon } from "@phosphor-icons/react/ssr";
import { Suspense } from "react";
import { MailSuggestions } from "@/components/home/mail-suggestions";
import { RemindersCard } from "@/components/home/reminders-card";
import { TodayTasks } from "@/components/home/today-tasks";
import { UserMenu } from "@/components/shell/user-menu";
import { ExamRow } from "@/components/university/exam-row";
import { countDay, daySentence, formatLongDate, greeting, hourIn } from "@/lib/home/summary";
import { timeIn } from "@/lib/jax/dates";
import { listMailSuggestions } from "@/lib/mail/queries";
import { listReminders } from "@/lib/reminders/queries";
import { instantToZoned } from "@/lib/reminders/time";
import { daysBetween, relativeDue, todayIn } from "@/lib/tasks/dates";
import { listNextOpenTasks } from "@/lib/tasks/queries";
import { editedAgo } from "@/lib/university/format";
import { listRecentPages, listUpcomingExams } from "@/lib/university/queries";
import type { ExamSummary } from "@/lib/university/types";

const rise = (delay = 0) => `atlasRise .7s ${delay}s cubic-bezier(.2,.8,.2,1) both`;

const TIME_ICON = { "Buenos días": SunHorizon, "Buenas tardes": Sun, "Buenas noches": MoonStars } as const;

/** The countdown strip only shows when the next exam is this close. */
const COUNTDOWN_DAYS = 30;

export default function InicioPage() {
  return (
    <>
      <Suspense fallback={<Skeleton />}>
        <Dashboard />
      </Suspense>
      {/* Mobile: the account and sign-out, out of the way at the end of Inicio (desktop has them in the sidebar). */}
      <div className="mt-14 rounded-[18px] bg-step md:hidden">
        <Suspense fallback={<div aria-hidden className="h-[50px]" />}>
          <UserMenu />
        </Suspense>
      </div>
    </>
  );
}

async function Dashboard() {
  // Everything here depends on "now": render per request.
  await connection();
  const now = new Date();
  const today = todayIn(now);

  // Inicio derives from the modules; it stores nothing of its own.
  const [tasks, exams, pages, reminders, suggestions] = await Promise.all([
    listNextOpenTasks(today),
    listUpcomingExams(today, 3),
    listRecentPages(3),
    listReminders(now),
    listMailSuggestions(),
  ]);
  const reminderViews = reminders.map((r) => {
    const at = instantToZoned(r.remindAt);
    return { id: r.id, title: r.title, day: relativeDue(at.date, today), time: at.time, past: Date.parse(r.remindAt) <= now.getTime() };
  });
  const counts = countDay(tasks, exams, today);
  const hello = greeting(hourIn(now));
  const TimeIcon = TIME_ICON[hello as keyof typeof TIME_ICON] ?? Sun;
  const next = exams.find((e) => daysBetween(today, e.date) >= 0 && daysBetween(today, e.date) <= COUNTDOWN_DAYS);

  return (
    <div className="flex flex-col">
      <header className="mb-10" style={{ animation: rise() }}>
        <p className="flex items-center gap-2 text-[14px] font-medium text-neutral-500">
          <TimeIcon weight="fill" size={16} color="var(--color-text)" />
          {formatLongDate(today)}
        </p>
        <h1 className="my-3 text-[clamp(52px,8.5vw,104px)] leading-[0.95] font-extrabold tracking-[-0.05em]">{hello}</h1>
        <p className="m-0 max-w-[40ch] text-[clamp(19px,2vw,23px)] leading-[1.35] text-neutral-300">{daySentence(counts)}</p>
      </header>

      <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
        <MailSuggestions suggestions={suggestions} />
        <section
          aria-labelledby="home-tasks"
          className="flex flex-col gap-3 rounded-[22px] bg-surface p-6"
          style={{ animation: rise(0.08) }}
        >
          <CardHeading id="home-tasks" title="Próximas tareas" href="/tareas" linkLabel="Ver todas las tareas" />
          <TodayTasks
            tasks={tasks}
            today={today}
            empty={
              <div className="flex flex-col items-start gap-4 py-1">
                <p className="m-0 text-[16px] leading-[1.5] text-neutral-300">No tienes tareas pendientes con fecha.</p>
                <Link
                  href="/tareas"
                  className="pressable inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-on-accent transition-[background,scale] hover:bg-accent-500"
                >
                  <Plus size={16} weight="bold" />
                  Añadir tarea
                </Link>
              </div>
            }
          />
        </section>

        <section
          aria-labelledby="home-exams"
          className="flex flex-col gap-3 rounded-[22px] bg-surface p-6"
          style={{ animation: rise(0.14) }}
        >
          <CardHeading id="home-exams" title="Exámenes" href="/calendario" linkLabel="Ir al calendario" />
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

          {pages.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              <h3 className="m-0 text-[13px] font-semibold text-neutral-500">Seguir con tus apuntes</h3>
              <ul className="flex flex-col gap-2">
                {pages.map((page) => (
                  <li key={page.id}>
                    <Link
                      href={`/universidad/${page.subjectId}/paginas/${page.id}`}
                      className="pressable flex items-center gap-[14px] rounded-[16px] bg-step p-3 transition-[background,scale] duration-200 hover:bg-neutral-800"
                    >
                      <span className="grid size-[42px] flex-none place-items-center rounded-[12px] bg-surface">
                        <FileText size={20} color="var(--color-text)" />
                      </span>
                      <span className="flex min-w-0 flex-col gap-[2px]">
                        <span className="truncate text-[15px] font-semibold">{page.title}</span>
                        <span className="flex gap-2 text-[12.5px] whitespace-nowrap text-neutral-500">
                          <span className="truncate">{page.subjectName}</span>
                          <span aria-hidden>·</span>
                          <span className="shrink-0">Editado {editedAgo(page.updatedAt, now)}</span>
                        </span>
                      </span>
                      <CaretRight size={14} color="var(--color-neutral-500)" className="ml-auto flex-none" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div style={{ animation: rise(0.18) }}>
          <RemindersCard reminders={reminderViews} today={today} nowTime={timeIn(now)} />
        </div>

        {next && <Countdown exam={next} today={today} />}
      </div>
    </div>
  );
}

/** Ink strip: days to the next exam, set huge. The one dark field on the page. */
function Countdown({ exam, today }: { exam: ExamSummary; today: string }) {
  const n = daysBetween(today, exam.date);
  const big = n === 0 ? "Hoy" : n === 1 ? "Mañana" : `${n} días`;
  return (
    <section
      aria-label="Próximo examen"
      className="col-span-full flex flex-col gap-3 rounded-[22px] bg-text p-6 text-bg sm:flex-row sm:items-center sm:gap-7 sm:px-8"
      style={{ animation: rise(0.2) }}
    >
      <span className="font-heading text-[clamp(52px,7vw,76px)] leading-none font-extrabold tracking-[-0.05em] whitespace-nowrap">
        {big}
      </span>
      <p className="m-0 max-w-[46ch] text-[16px] leading-[1.45] text-neutral-800">
        {n > 1 ? "para " : ""}
        <strong className="font-semibold text-bg">{exam.title}</strong> de {exam.subjectName}.{" "}
        <Link href="/jax" className="font-semibold text-accent-ink underline-offset-4 hover:underline">
          Pide a Jax un repaso con tus apuntes
        </Link>
      </p>
    </section>
  );
}

function CardHeading({ id, title, href, linkLabel }: { id: string; title: string; href: string; linkLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 id={id} className="m-0 text-[24px] tracking-[-0.035em]">
        {title}
      </h2>
      <Link
        href={href}
        aria-label={linkLabel}
        title={linkLabel}
        className="pressable grid size-9 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-step hover:text-text"
      >
        <ArrowUpRight size={18} />
      </Link>
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      <div className="mb-10 flex flex-col gap-3">
        <div className="h-4 w-48 animate-skeleton rounded bg-step" />
        <div className="h-20 w-96 max-w-full animate-skeleton rounded-[14px] bg-step" />
        <div className="h-6 w-2/3 animate-skeleton rounded bg-step" />
      </div>
      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
        <div className="h-56 animate-skeleton rounded-[22px] bg-step" />
        <div className="h-56 animate-skeleton rounded-[22px] bg-step" />
      </div>
    </div>
  );
}
