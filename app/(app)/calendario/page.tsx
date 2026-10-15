import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarView } from "@/components/calendar/calendar-view";
import { PageHeader } from "@/components/ui/page-header";
import { monthGrid, monthOf, parseDay, parseMonth } from "@/lib/calendar/grid";
import { listAgenda } from "@/lib/calendar/queries";
import { todayIn } from "@/lib/tasks/dates";
import { listSubjectOptions } from "@/lib/university/queries";

export const metadata: Metadata = { title: "Calendario" };

export default function CalendarioPage({ searchParams }: PageProps<"/calendario">) {
  return (
    <div className="animate-rise">
      <div className="mb-12">
        <PageHeader title="Calendario" lead="Eventos, entregas y exámenes en un solo sitio." />
      </div>
      <Suspense fallback={<Skeleton />}>
        <Calendar searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Calendar({ searchParams }: Pick<PageProps<"/calendario">, "searchParams">) {
  await connection();
  const today = todayIn(new Date());
  const params = await searchParams;
  const month = parseMonth(params.mes, monthOf(today));
  const fallbackDay = month === monthOf(today) ? today : `${month}-01`;
  const day = parseDay(params.dia, fallbackDay);

  const weeks = monthGrid(month);
  const [items, subjects] = await Promise.all([listAgenda(weeks[0][0], weeks[5][6]), listSubjectOptions()]);

  return (
    <CalendarView
      month={month}
      initialDay={monthOf(day) === month ? day : fallbackDay}
      today={today}
      items={items}
      subjects={subjects}
    />
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]">
      <div className="h-[480px] animate-skeleton rounded-[20px] bg-step" />
      <div className="h-48 animate-skeleton rounded-[18px] bg-step" />
    </div>
  );
}
