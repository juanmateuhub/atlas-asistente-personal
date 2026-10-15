import { dateBadge, examCountdown, formatGrade } from "@/lib/university/format";
import type { Exam } from "@/lib/university/types";

/** Calendar badge + exam details, in the "Señal" style. `subtitle` is usually the subject name. */
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

  return (
    <div className="group mx-[-10px] flex items-center gap-[14px] rounded-[14px] px-[10px] py-[6px] transition-[background] duration-200 hover:bg-[color-mix(in_srgb,var(--color-text)_5%,transparent)]">
      <div
        className={`flex h-[56px] w-[52px] flex-none flex-col items-center justify-center rounded-[14px] ${
          past ? "bg-step" : "bg-accent-800"
        }`}
      >
        <span className={`text-[11.5px] font-semibold ${past ? "text-neutral-500" : "text-accent-ink"}`}>{badge.month}</span>
        <span className={`font-heading text-[24px] leading-none font-bold tabular-nums ${past ? "text-neutral-400" : ""}`}>
          {badge.day}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="truncate text-[15.5px] font-semibold">{exam.title}</span>
        <span className="flex flex-wrap gap-x-2 text-[12.5px] text-neutral-500">
          {subtitle && (
            <>
              <span>{subtitle}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span>
            {examCountdown(exam.date, today)}
            {exam.time && `, ${exam.time}`}
          </span>
          {exam.location && (
            <>
              <span aria-hidden>·</span>
              <span>{exam.location}</span>
            </>
          )}
          {exam.grade !== null && (
            <>
              <span aria-hidden>·</span>
              <span className="font-semibold text-neutral-200 tabular-nums">Nota: {formatGrade(exam.grade)}</span>
            </>
          )}
        </span>
      </div>
      {actions}
    </div>
  );
}
