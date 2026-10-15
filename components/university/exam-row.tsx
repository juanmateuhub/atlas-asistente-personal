import { dateBadge, examCountdown, formatGrade } from "@/lib/university/format";
import type { Exam } from "@/lib/university/types";

/** Calendar badge + exam details, as in the redesign. `subtitle` is usually the subject name. */
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
    <div className="group mx-[-10px] flex items-center gap-[14px] rounded-[14px] px-[10px] py-[6px] transition-[background] duration-200 hover:bg-[color-mix(in_srgb,var(--color-text)_4%,transparent)]">
      <div
        className="flex h-[50px] w-[46px] flex-none flex-col items-center justify-center rounded-[12px] bg-surface"
        style={{
          boxShadow: past
            ? "0 0 0 1px color-mix(in srgb, var(--color-text) 8%, transparent)"
            : "0 0 0 1px color-mix(in srgb, var(--color-accent) 30%, transparent)",
        }}
      >
        <span className={`text-[10px] tracking-[0.08em] uppercase ${past ? "text-neutral-500" : "text-accent-300"}`}>
          {badge.month}
        </span>
        <span className={`text-[19px] leading-[1.1] font-medium tabular-nums ${past ? "text-neutral-400" : ""}`}>
          {badge.day}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="truncate text-[15px] font-medium">{exam.title}</span>
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
              <span className="font-medium text-neutral-300 tabular-nums">Nota: {formatGrade(exam.grade)}</span>
            </>
          )}
        </span>
      </div>
      {actions}
    </div>
  );
}
