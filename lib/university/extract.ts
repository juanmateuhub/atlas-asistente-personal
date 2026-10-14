import "server-only";
import { TEXT_MAX_CHARS } from "./files";

/** Plain text from an uploaded document. PDFs without a text layer (scans) return "". */
export async function extractDocumentText(
  bytes: ArrayBuffer,
  mime: string,
): Promise<{ text: string; pages: number | null }> {
  let text = "";
  let pages: number | null = null;

  if (mime === "application/pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const result = await extractText(pdf, { mergePages: true });
    text = result.text;
    pages = result.totalPages;
  } else if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    text = result.value;
  } else {
    text = new TextDecoder("utf-8").decode(bytes);
  }

  // Normalise whitespace, drop control characters, cap the size.
  text = text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, TEXT_MAX_CHARS);

  return { text, pages };
}
