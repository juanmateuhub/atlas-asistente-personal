"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { parseTaskId as parseId } from "@/lib/tasks/validation";
import { extractDocumentText } from "@/lib/university/extract";
import { FILES_BUCKET, FILE_KINDS, checkFile, type FileKind } from "@/lib/university/files";

export type RegisterResult = { ok: true; hasText: boolean } | { ok: false; error: string };

/**
 * Called after the browser uploaded a file to Storage: verifies it is in the
 * caller's folder for that subject, extracts its text and records it.
 */
export async function registerSubjectFile(input: {
  subjectId: string;
  path: string;
  name: string;
  kind: string;
}): Promise<RegisterResult> {
  const user = await getCurrentUser();
  const subjectId = parseId(input.subjectId);
  if (!subjectId) return { ok: false, error: "Asignatura no válida." };
  const kind: FileKind = (FILE_KINDS as readonly string[]).includes(input.kind) ? (input.kind as FileKind) : "apuntes";
  const name = String(input.name ?? "").trim().slice(0, 200);
  const path = String(input.path ?? "");

  // The object must sit in this user's folder for this subject (no path tricks).
  const prefix = `${user.id}/${subjectId}/`;
  if (!path.startsWith(prefix) || path.includes("..") || path.slice(prefix.length).includes("/")) {
    return { ok: false, error: "Ruta de archivo no válida." };
  }

  const supabase = await createClient();
  const { data: blob, error: downloadError } = await supabase.storage.from(FILES_BUCKET).download(path);
  if (downloadError || !blob) return { ok: false, error: "No se ha encontrado el archivo subido." };

  const check = checkFile(name, blob.size);
  const cleanup = () => supabase.storage.from(FILES_BUCKET).remove([path]);
  if (!check.ok) {
    await cleanup();
    return { ok: false, error: check.error };
  }

  let extracted: { text: string; pages: number | null };
  try {
    extracted = await extractDocumentText(await blob.arrayBuffer(), check.mime);
  } catch {
    await cleanup();
    return { ok: false, error: "No se ha podido leer el archivo. ¿Está dañado o protegido con contraseña?" };
  }

  const { error } = await supabase.from("subject_files").insert({
    subject_id: subjectId,
    storage_path: path,
    name,
    kind,
    mime_type: check.mime,
    size_bytes: blob.size,
    page_count: extracted.pages,
    text_content: extracted.text,
  });
  if (error) {
    await cleanup();
    return { ok: false, error: "No se ha podido guardar el archivo. Inténtalo de nuevo." };
  }

  refresh();
  return { ok: true, hasText: extracted.text.length > 0 };
}

export async function deleteSubjectFile(_prev: { error?: string; ok?: boolean }, fd: FormData) {
  await getCurrentUser();
  const id = parseId(fd.get("id"));
  if (!id) return { error: "Archivo no válido." };

  const supabase = await createClient();
  const { data: file } = await supabase.from("subject_files").select("storage_path").eq("id", id).maybeSingle();
  if (!file) return { error: "Ese archivo ya no existe." };

  const { error } = await supabase.from("subject_files").delete().eq("id", id);
  if (error) return { error: "No se ha podido borrar. Inténtalo de nuevo." };
  await supabase.storage.from(FILES_BUCKET).remove([file.storage_path]);

  refresh();
  return { ok: true };
}
