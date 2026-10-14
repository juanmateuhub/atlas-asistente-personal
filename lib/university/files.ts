export const FILES_BUCKET = "subject-files";
export const FILE_MAX_BYTES = 15 * 1024 * 1024;
/** Extracted text kept per document. The DB caps it at 2 MB; 800k chars stays under even with multi-byte text. */
export const TEXT_MAX_CHARS = 800_000;

export const FILE_KINDS = ["apuntes", "guia", "otro"] as const;
export type FileKind = (typeof FILE_KINDS)[number];
export const FILE_KIND_LABEL: Record<FileKind, string> = {
  apuntes: "Apuntes",
  guia: "Guía docente",
  otro: "Otro",
};

/** Extension → MIME type we accept (browsers report .md inconsistently, so we derive it). */
const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
};

export const ACCEPT = Object.keys(TYPES)
  .map((ext) => `.${ext}`)
  .join(",");

export type SubjectFile = {
  id: string;
  name: string;
  kind: FileKind;
  sizeBytes: number;
  pageCount: number | null;
  hasText: boolean;
  createdAt: string;
};

export function fileType(name: string): string | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return TYPES[ext] ?? null;
}

/** Validates a file the user picked, before uploading. */
export function checkFile(name: string, size: number): { ok: true; mime: string } | { ok: false; error: string } {
  const mime = fileType(name);
  if (!mime) return { ok: false, error: "Solo se pueden subir PDF, Word (.docx), .txt o .md." };
  if (size <= 0) return { ok: false, error: "El archivo está vacío." };
  if (size > FILE_MAX_BYTES) return { ok: false, error: "El archivo pesa más de 15 MB." };
  return { ok: true, mime };
}

/** Storage-safe object name: keeps the extension, drops accents and odd characters. */
export function safeObjectName(rawName: string): string {
  // Only the file name: drop any path the browser (or an attacker) put in front.
  const name = rawName.split(/[\\/]/).pop() ?? "";
  const extMatch = /\.([A-Za-z0-9]{1,5})$/.exec(name);
  const dot = extMatch ? name.length - extMatch[0].length : -1;
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  return `${base || "archivo"}${ext ? `.${ext}` : ""}`;
}

/** `<user>/<subject>/<random>-<name>`: the first folder is what Storage RLS checks. */
export function storagePath(userId: string, subjectId: string, random: string, name: string): string {
  return `${userId}/${subjectId}/${random}-${safeObjectName(name)}`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
}
