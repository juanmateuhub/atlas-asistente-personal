"use client";

import { deletePage } from "@/app/(app)/universidad/actions";
import { ActionDialog } from "@/components/ui/action-dialog";
import { iconButtonClass } from "@/components/ui/form";

export function PageDeleteButton({
  pageId,
  subjectId,
  title,
  icon,
}: {
  pageId: string;
  subjectId: string;
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <ActionDialog
      title="¿Borrar esta página?"
      action={deletePage}
      submitLabel="Borrar página"
      pendingLabel="Borrando…"
      danger
      trigger={(open) => (
        <button type="button" onClick={open} aria-label="Borrar página" className={iconButtonClass}>
          {icon}
        </button>
      )}
    >
      <input type="hidden" name="id" value={pageId} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <p className="text-base">Vas a borrar «{title}» y todos sus apuntes. No se puede deshacer.</p>
    </ActionDialog>
  );
}
