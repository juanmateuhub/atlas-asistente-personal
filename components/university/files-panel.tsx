"use client";

import { AnimatePresence, motion } from "motion/react";
import { FileText, FileWarning, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { deleteSubjectFile, registerSubjectFile } from "@/app/(app)/universidad/files-actions";
import { ActionDialog } from "@/components/ui/action-dialog";
import { iconButtonClass } from "@/components/ui/form";
import { createBrowserSupabase } from "@/lib/supabase/client";
import {
  ACCEPT,
  FILES_BUCKET,
  FILE_KINDS,
  FILE_KIND_LABEL,
  checkFile,
  formatSize,
  storagePath,
  type FileKind,
  type SubjectFile,
} from "@/lib/university/files";

type Upload = { key: string; name: string; step: "subiendo" | "leyendo"; error?: string };

/**
 * Documents of a subject (notes, syllabus…). Files go straight from the browser
 * to private Storage (no server size limit), then the server extracts their text
 * so Jax can answer from them.
 */
export function FilesPanel({ subjectId, userId, files }: { subjectId: string; userId: string; files: SubjectFile[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<FileKind>("apuntes");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const patch = (key: string, change: Partial<Upload>) =>
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...change } : u)));

  async function upload(list: FileList | File[]) {
    setNotice(null);
    const supabase = createBrowserSupabase();
    for (const file of Array.from(list)) {
      const key = crypto.randomUUID();
      const check = checkFile(file.name, file.size);
      setUploads((u) => [...u, { key, name: file.name, step: "subiendo", error: check.ok ? undefined : check.error }]);
      if (!check.ok) continue;

      const path = storagePath(userId, subjectId, key.slice(0, 8), file.name);
      const { error } = await supabase.storage.from(FILES_BUCKET).upload(path, file, { contentType: check.mime, upsert: false });
      if (error) {
        patch(key, { error: "No se ha podido subir. Comprueba tu conexión." });
        continue;
      }
      patch(key, { step: "leyendo" });
      const result = await registerSubjectFile({ subjectId, path, name: file.name, kind });
      if (!result.ok) {
        patch(key, { error: result.error });
        continue;
      }
      if (!result.hasText) {
        setNotice(`«${file.name}» no tiene texto seleccionable (¿es un escaneo?). Se guarda, pero Jax no podrá leerlo.`);
      }
      setUploads((u) => u.filter((x) => x.key !== key));
    }
  }

  return (
    <section aria-labelledby="files-title" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="files-title" className="text-lead font-medium">
          Documentos
        </h2>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
        }}
        className={`flex flex-col gap-3 rounded-atlas border border-dashed p-4 transition-colors ${
          dragging ? "border-accent bg-line/20" : "border-line"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="pressable inline-flex items-center gap-2 rounded-atlas bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-500"
          >
            <Upload aria-hidden className="size-4" />
            Subir archivos
          </button>
          <label htmlFor="file-kind" className="sr-only">
            Tipo de documento
          </label>
          <select
            id="file-kind"
            value={kind}
            onChange={(e) => setKind(e.currentTarget.value as FileKind)}
            className="rounded-atlas border border-line bg-surface px-4 py-2 text-sm text-ink focus-visible:border-accent"
          >
            {FILE_KINDS.map((k) => (
              <option key={k} value={k}>
                {FILE_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted">
          PDF, Word, .txt o .md, hasta 15 MB. Arrástralos aquí. Jax los leerá para responderte.
        </p>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            if (e.currentTarget.files?.length) void upload(e.currentTarget.files);
            e.currentTarget.value = "";
          }}
        />
      </div>

      {notice && (
        <p role="status" className="animate-enter rounded-atlas bg-line/20 px-4 py-3 text-sm text-ink">
          {notice}
        </p>
      )}

      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {uploads.map((u) => (
            <motion.li
              key={u.key}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 px-3 py-3"
            >
              {u.error ? (
                <FileWarning aria-hidden className="size-5 shrink-0 text-red-700" />
              ) : (
                <Loader2 aria-hidden className="size-5 shrink-0 animate-spin text-accent-ink motion-reduce:animate-none" />
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-ink">{u.name}</span>
                <span className={`text-xs ${u.error ? "text-red-700" : "text-muted"}`}>
                  {u.error ?? (u.step === "subiendo" ? "Subiendo…" : "Leyendo el texto…")}
                </span>
              </span>
              {u.error && (
                <button
                  type="button"
                  onClick={() => setUploads((list) => list.filter((x) => x.key !== u.key))}
                  className="pressable text-xs font-medium text-muted hover:text-ink"
                >
                  Cerrar
                </button>
              )}
            </motion.li>
          ))}
          {files.map((f) => (
            <motion.li
              key={f.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.16 } }}
              className="group flex items-center gap-3 rounded-atlas px-3 py-3 hover:bg-line/15"
            >
              <a
                href={`/api/archivos/${f.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-atlas bg-line/25 text-accent-ink">
                  <FileText aria-hidden className="size-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-base text-ink">{f.name}</span>
                  <span className="flex flex-wrap gap-x-3 text-xs text-muted">
                    <span>{FILE_KIND_LABEL[f.kind]}</span>
                    <span>{formatSize(f.sizeBytes)}</span>
                    {f.pageCount !== null && <span>{f.pageCount} págs.</span>}
                    {!f.hasText && <span className="text-red-700">Sin texto legible</span>}
                  </span>
                </span>
              </a>
              <div className="opacity-100 transition-opacity duration-150 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                <ActionDialog
                  title="¿Borrar este documento?"
                  action={deleteSubjectFile}
                  submitLabel="Borrar documento"
                  pendingLabel="Borrando…"
                  danger
                  trigger={(open) => (
                    <button type="button" onClick={open} aria-label={`Borrar "${f.name}"`} className={iconButtonClass}>
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  )}
                >
                  <input type="hidden" name="id" value={f.id} />
                  <p className="text-base">Vas a borrar «{f.name}». Jax dejará de usarlo. No se puede deshacer.</p>
                </ActionDialog>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
