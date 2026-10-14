/** Plain text from a Tiptap/ProseMirror JSON doc: one line per block. */
export function docToText(node: unknown): string {
  const lines: string[] = [];
  walk(node, lines);
  return lines
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

const BLOCKS = new Set(["paragraph", "heading", "listItem", "blockquote", "codeBlock"]);

function walk(node: unknown, lines: string[]) {
  if (!node || typeof node !== "object") return;
  const n = node as { type?: unknown; text?: unknown; content?: unknown };
  if (n.type === "text" && typeof n.text === "string") {
    if (lines.length === 0) lines.push("");
    lines[lines.length - 1] += n.text;
    return;
  }
  const isBlock = typeof n.type === "string" && BLOCKS.has(n.type);
  if (isBlock) lines.push("");
  if (Array.isArray(n.content)) for (const child of n.content) walk(child, lines);
  if (isBlock) lines.push("");
}
