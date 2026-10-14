import { describe, expect, it } from "vitest";
import { chunkText } from "@/lib/jax/search";
import { extractDocumentText } from "@/lib/university/extract";
import { checkFile, fileType, formatSize, safeObjectName, storagePath } from "@/lib/university/files";

describe("upload checks", () => {
  it("accepts PDF, Word, txt and md by extension", () => {
    expect(fileType("Tema 1.PDF")).toBe("application/pdf");
    expect(fileType("apuntes.docx")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(fileType("resumen.md")).toBe("text/markdown");
    expect(fileType("foto.jpg")).toBeNull();
    expect(fileType("virus.exe")).toBeNull();
  });

  it("rejects empty and oversized files", () => {
    expect(checkFile("a.pdf", 0).ok).toBe(false);
    expect(checkFile("a.pdf", 16 * 1024 * 1024).ok).toBe(false);
    expect(checkFile("a.pdf", 1024)).toEqual({ ok: true, mime: "application/pdf" });
  });

  it("builds safe storage paths inside the user's folder", () => {
    expect(safeObjectName("Tema 3: Capa de transporte (versión final).PDF")).toBe("Tema-3-Capa-de-transporte-version-final.pdf");
    expect(safeObjectName("../../etc/passwd")).toBe("passwd");
    expect(safeObjectName("C:\\fakepath\\Tema 2.pdf")).toBe("Tema-2.pdf");
    expect(storagePath("u1", "s1", "abcd1234", "Álgebra.docx")).toBe("u1/s1/abcd1234-Algebra.docx");
  });

  it("formats sizes in Spanish", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(2048)).toBe("2 KB");
    expect(formatSize(3.5 * 1024 * 1024)).toBe("3,5 MB");
  });
});

describe("text extraction", () => {
  it("reads plain text and cleans control characters and spacing", async () => {
    const bytes = new TextEncoder().encode("Tema 1\r\n\r\n\r\n\r\nTCP   es\tfiable\u0007.").buffer;
    expect(await extractDocumentText(bytes, "text/plain")).toEqual({ text: "Tema 1\n\nTCP es fiable.", pages: null });
  });
});

describe("chunkText", () => {
  it("keeps paragraphs together and splits very long ones", () => {
    const text = ["a".repeat(1000), "b".repeat(1000), "c".repeat(1000), "d".repeat(9000)].join("\n\n");
    const chunks = chunkText(text, 2500);
    expect(chunks[0]).toBe(`${"a".repeat(1000)}\n\n${"b".repeat(1000)}`);
    expect(chunks.every((c) => c.length <= 3750)).toBe(true);
    expect(chunks.join("").replace(/\n/g, "").length).toBe(12000);
  });
});
