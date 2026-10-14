import type { DocJSON } from "@/lib/university/types";
import { parseMarkdown, type Inline } from "./markdown";

type TextNode = { type: "text"; text: string; marks?: { type: "bold" }[] };

function inlineToNodes(parts: Inline[]): TextNode[] {
  return parts
    .filter((p) => p.type !== "cite")
    .map((p) =>
      p.type === "bold" ? { type: "text", text: p.text, marks: [{ type: "bold" }] } : { type: "text", text: (p as { text: string }).text },
    )
    .filter((n) => n.text.length > 0) as TextNode[];
}

const paragraph = (nodes: TextNode[]) => (nodes.length ? { type: "paragraph", content: nodes } : { type: "paragraph" });

/** Converts Jax's Markdown subset into a Tiptap document for a new note page. */
export function markdownToDoc(source: string): DocJSON {
  const content: unknown[] = [];
  for (const block of parseMarkdown(source)) {
    if (block.type === "list") {
      content.push({
        type: "bulletList",
        content: block.items.map((item) => ({ type: "listItem", content: [paragraph(inlineToNodes(item))] })),
      });
    } else {
      for (const line of block.lines) content.push(paragraph(inlineToNodes(line)));
    }
  }
  return { type: "doc", content };
}
