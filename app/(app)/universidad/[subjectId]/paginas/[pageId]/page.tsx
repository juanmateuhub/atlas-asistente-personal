import { Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { NoteEditor } from "@/components/university/note-editor";
import { PageDeleteButton } from "@/components/university/page-delete-button";
import { parseTaskId as parseId } from "@/lib/tasks/validation";
import { getNotePage } from "@/lib/university/queries";

export default function NotePageRoute({ params }: PageProps<"/universidad/[subjectId]/paginas/[pageId]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Note params={params} />
    </Suspense>
  );
}

async function Note({ params }: Pick<PageProps<"/universidad/[subjectId]/paginas/[pageId]">, "params">) {
  const raw = await params;
  const subjectId = parseId(raw.subjectId);
  const pageId = parseId(raw.pageId);
  if (!subjectId || !pageId) notFound();
  const page = await getNotePage(subjectId, pageId);
  if (!page) notFound();

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <title>{`${page.title} · Atlas`}</title>
      <div className="flex items-center justify-between gap-4">
        <Breadcrumbs
          items={[
            { href: "/universidad", label: "Universidad" },
            { href: `/universidad/${page.subject.id}`, label: page.subject.name },
            { label: page.topic.title },
          ]}
        />
        <PageDeleteButton pageId={page.id} subjectId={page.subject.id} title={page.title} icon={<Trash2 aria-hidden className="size-4" />} />
      </div>
      {/* key: a different page must start with fresh editor and autosave state. */}
      <NoteEditor
        key={page.id}
        pageId={page.id}
        initialTitle={page.title}
        initialContent={page.content}
        initialVersion={page.version}
      />
    </article>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="h-5 w-64 animate-skeleton rounded-atlas bg-line/20" />
      <div className="h-14 w-2/3 animate-skeleton rounded-atlas bg-line/20" />
      <div className="h-10 animate-skeleton rounded-atlas bg-line/20" />
      <div className="h-80 animate-skeleton rounded-atlas bg-line/20" />
    </div>
  );
}
