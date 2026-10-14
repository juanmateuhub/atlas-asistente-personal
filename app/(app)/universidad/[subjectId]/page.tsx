import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ExamsPanel } from "@/components/university/exams-panel";
import { FilesPanel } from "@/components/university/files-panel";
import { SubjectActions } from "@/components/university/subject-actions";
import { TopicsPanel } from "@/components/university/topics-panel";
import { getCurrentUser } from "@/lib/auth/user";
import { todayIn } from "@/lib/tasks/dates";
import { parseTaskId as parseId } from "@/lib/tasks/validation";
import { getSubjectDetail } from "@/lib/university/queries";

export default function SubjectPage({ params }: PageProps<"/universidad/[subjectId]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Subject params={params} />
    </Suspense>
  );
}

async function Subject({ params }: Pick<PageProps<"/universidad/[subjectId]">, "params">) {
  const subjectId = parseId((await params).subjectId);
  if (!subjectId) notFound();
  const [user, detail] = await Promise.all([getCurrentUser(), getSubjectDetail(subjectId)]);
  if (!detail) notFound();
  const { subject, topics, exams, files } = detail;

  return (
    <>
      <title>{`${subject.name} · Atlas`}</title>
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ href: "/universidad", label: "Universidad" }, { label: subject.name }]} />
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <header className="flex min-w-0 flex-col gap-2">
            <h1 className="text-title font-bold md:text-display">{subject.name}</h1>
            {subject.description && (
              <p className="max-w-2xl whitespace-pre-line text-base text-muted">{subject.description}</p>
            )}
          </header>
          <SubjectActions subject={subject} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <TopicsPanel subjectId={subject.id} topics={topics} />
        <div className="flex flex-col gap-12">
          <FilesPanel subjectId={subject.id} userId={user.id} files={files} />
          <ExamsPanel subjectId={subject.id} exams={exams} today={todayIn(new Date())} />
        </div>
      </div>
    </>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8">
      <div className="h-16 w-2/3 animate-skeleton rounded-atlas bg-line/20" />
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[3fr_2fr]">
        <div className="h-64 animate-skeleton rounded-atlas bg-line/20" />
        <div className="h-40 animate-skeleton rounded-atlas bg-line/20" />
      </div>
    </div>
  );
}
