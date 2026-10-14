import { dateBadge, examCountdown, formatGrade } from "@/lib/university/format";
import type { Exam } from "@/lib/university/types";

/** Calendar badge + exam details. `subtitle` is usually the subject name. */
export function ExamRow({
  exam,
  today,
  subtitle,
  actions,
}: {
  exam: Exam;
  today: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const badge = dateBadge(exam.date);
  const past = exam.date < today;
  const soon = !past && examCountdown(exam.date, today).match(/^(Hoy|Mañana|Este)/);

  return (
    <div className="group flex items-center gap-4 rounded-atlas px-3 py-3 hover:bg-line/15">
      <div
        className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-atlas leading-none ${
          past ? "bg-line/20 text-muted" : "bg-accent text-white"
        }`}
      >
        <span className="text-base font-bold tabular-nums">{badge.day}</span>
        <span className="text-caption">{badge.month}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-base text-ink">{exam.title}</p>
        <p className="flex flex-wrap gap-x-3 text-xs text-muted">
          {subtitle && <span>{subtitle}</span>}
          <span className={soon ? "font-medium text-accent" : undefined}>
            {examCountdown(exam.date, today)}
            {exam.time && `, ${exam.time}`}
          </span>
          {exam.location && <span>{exam.location}</span>}
          {exam.grade !== null && (
            <span className="font-medium text-ink tabular-nums">Nota: {formatGrade(exam.grade)}</span>
          )}
        </p>
      </div>
      {actions}
    </div>
  );
}
