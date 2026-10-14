"use client";

import { AnimatePresence, motion } from "motion/react";
import { FileText, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { createPage, createTopic, deleteTopic, renameTopic } from "@/app/(app)/universidad/actions";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Field, iconButtonClass, inputClass } from "@/components/ui/form";
import type { Topic } from "@/lib/university/types";
import { TITLE_MAX } from "@/lib/university/validation";
import { InlineCreate } from "./inline-create";

export function TopicsPanel({ subjectId, topics }: { subjectId: string; topics: Topic[] }) {
  return (
    <section aria-labelledby="topics-title" className="flex flex-col gap-4">
      <h2 id="topics-title" className="text-lead font-medium">
        Temas
      </h2>

      {topics.length === 0 && (
        <p className="text-base text-muted">
          Crea un tema para empezar a tomar apuntes. Dentro de cada tema puedes tener varias páginas.
        </p>
      )}

      <ol className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {topics.map((topic, i) => (
            <motion.li
              key={topic.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.16 } }}
              className="flex flex-col gap-1 rounded-atlas border border-line p-4"
            >
              <TopicHeader topic={topic} index={i + 1} />
              <ul className="flex flex-col">
                <AnimatePresence initial={false}>
                  {topic.pages.map((page) => (
                    <motion.li
                      key={page.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <Link
                        href={`/universidad/${subjectId}/paginas/${page.id}`}
                        className="pressable flex items-center gap-3 rounded-atlas px-3 py-2 text-base text-body hover:bg-line/20 hover:text-ink"
                      >
                        <FileText aria-hidden className="size-4 shrink-0 text-muted" />
                        <span className="truncate">{page.title}</span>
                      </Link>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
              <InlineCreate
                label="Nueva página"
                placeholder="Título de la página"
                action={createPage}
                hidden={{ subjectId, topicId: topic.id }}
                maxLength={TITLE_MAX}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>

      <InlineCreate
        label="Nuevo tema"
        placeholder="Ej. Tema 3: Capa de transporte"
        action={createTopic}
        hidden={{ subjectId }}
        maxLength={TITLE_MAX}
      />
    </section>
  );
}

function TopicHeader({ topic, index }: { topic: Topic; index: number }) {
  return (
    <div className="group flex items-center gap-3">
      {/* Topics are an ordered sequence, so the number carries meaning. */}
      <span className="w-6 shrink-0 text-sm font-medium text-muted tabular-nums">{index}</span>
      <h3 className="min-w-0 flex-1 truncate text-base font-medium">{topic.title}</h3>
      <div className="flex opacity-100 transition-opacity duration-150 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        <ActionDialog
          title="Renombrar tema"
          action={renameTopic}
          submitLabel="Guardar"
          pendingLabel="Guardando…"
          trigger={(open) => (
            <button type="button" onClick={open} aria-label={`Renombrar "${topic.title}"`} className={iconButtonClass}>
              <Pencil aria-hidden className="size-4" />
            </button>
          )}
        >
          <input type="hidden" name="id" value={topic.id} />
          <Field label="Título" htmlFor={`topic-${topic.id}-title`}>
            <input
              id={`topic-${topic.id}-title`}
              name="title"
              required
              maxLength={TITLE_MAX}
              defaultValue={topic.title}
              className={inputClass}
            />
          </Field>
        </ActionDialog>
        <ActionDialog
          title="¿Borrar este tema?"
          action={deleteTopic}
          submitLabel="Borrar tema"
          pendingLabel="Borrando…"
          danger
          trigger={(open) => (
            <button type="button" onClick={open} aria-label={`Borrar "${topic.title}"`} className={iconButtonClass}>
              <Trash2 aria-hidden className="size-4" />
            </button>
          )}
        >
          <input type="hidden" name="id" value={topic.id} />
          <p className="text-base">
            Vas a borrar «{topic.title}»
            {topic.pages.length > 0 &&
              ` y sus ${topic.pages.length === 1 ? "apuntes (1 página)" : `${topic.pages.length} páginas de apuntes`}`}
            . No se puede deshacer.
          </p>
        </ActionDialog>
      </div>
    </div>
  );
}
