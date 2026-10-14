"use client";

import { AnimatePresence, motion } from "motion/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createExam, deleteExam, updateExam } from "@/app/(app)/universidad/actions";
import { ActionDialog } from "@/components/ui/action-dialog";
import { iconButtonClass } from "@/components/ui/form";
import type { Exam } from "@/lib/university/types";
import { ExamRow } from "./exam-row";
import { ExamFields } from "./fields";

export function ExamsPanel({ subjectId, exams, today }: { subjectId: string; exams: Exam[]; today: string }) {
  return (
    <section aria-labelledby="exams-title" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="exams-title" className="text-lead font-medium">
          Exámenes
        </h2>
        <ActionDialog
          title="Nuevo examen"
          action={createExam}
          submitLabel="Añadir examen"
          pendingLabel="Añadiendo…"
          trigger={(open) => (
            <button type="button" onClick={open} aria-label="Añadir examen" className={iconButtonClass}>
              <Plus aria-hidden className="size-5" />
            </button>
          )}
        >
          <input type="hidden" name="subjectId" value={subjectId} />
          <ExamFields idPrefix="new-exam" />
        </ActionDialog>
      </div>

      {exams.length === 0 ? (
        <p className="text-base text-muted">Sin exámenes. Añade las fechas para verlas en Inicio y en Universidad.</p>
      ) : (
        <ul className="flex flex-col">
          <AnimatePresence initial={false}>
            {exams.map((exam) => (
              <motion.li
                key={exam.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.16 } }}
              >
                <ExamRow
                  exam={exam}
                  today={today}
                  actions={
                    <div className="flex opacity-100 transition-opacity duration-150 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                      <ActionDialog
                        title="Editar examen"
                        action={updateExam}
                        submitLabel="Guardar cambios"
                        pendingLabel="Guardando…"
                        trigger={(open) => (
                          <button type="button" onClick={open} aria-label={`Editar "${exam.title}"`} className={iconButtonClass}>
                            <Pencil aria-hidden className="size-4" />
                          </button>
                        )}
                      >
                        <input type="hidden" name="id" value={exam.id} />
                        <ExamFields idPrefix={`exam-${exam.id}`} exam={exam} />
                      </ActionDialog>
                      <ActionDialog
                        title="¿Borrar este examen?"
                        action={deleteExam}
                        submitLabel="Borrar examen"
                        pendingLabel="Borrando…"
                        danger
                        trigger={(open) => (
                          <button type="button" onClick={open} aria-label={`Borrar "${exam.title}"`} className={iconButtonClass}>
                            <Trash2 aria-hidden className="size-4" />
                          </button>
                        )}
                      >
                        <input type="hidden" name="id" value={exam.id} />
                        <p className="text-base">Vas a borrar «{exam.title}». No se puede deshacer.</p>
                      </ActionDialog>
                    </div>
                  }
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
