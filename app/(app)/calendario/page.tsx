import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarView } from "@/components/calendar/calendar-view";
import { PageHeader } from "@/components/ui/page-header";
import { monthGrid, monthOf, parseDay, parseMonth } from "@/lib/calendar/grid";
import { listAgenda } from "@/lib/calendar/queries";
import { todayIn } from "@/lib/tasks/dates";

export const metadata: Metadata = { title: "Calendario" };

export default function CalendarioPage({ searchParams }: PageProps<"/calendario">) {
  return (
    <>
      <PageHeader title="Calendario" lead="Eventos, entregas y exámenes en un solo sitio." />
      <Suspense fallback={<Skeleton />}>
        <Calendar searchParams={searchParams} />
      </Suspense>
    </>
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
  const items = await listAgenda(weeks[0][0], weeks[5][6]);

  return (
    <CalendarView
      month={month}
      initialDay={monthOf(day) === month ? day : fallbackDay}
      today={today}
      items={items}
    />
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="grid grid-cols-1 gap-12 lg:grid-cols-[3fr_2fr]">
      <div className="h-[28rem] animate-skeleton rounded-atlas bg-line/20" />
      <div className="h-48 animate-skeleton rounded-atlas bg-line/20" />
    </div>
  );
}
