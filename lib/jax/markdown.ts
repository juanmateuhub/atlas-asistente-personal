/**
 * Tiny Markdown subset for Jax answers: paragraphs, "- " lists, **bold** and
 * [n1] citation markers. Produces a tree that React renders as text nodes, so
 * model output can never inject HTML.
 */

export type Inline = { type: "text"; text: string } | { type: "bold"; text: string } | { type: "cite"; ref: string };
export type Block = { type: "paragraph"; lines: Inline[][] } | { type: "list"; items: Inline[][] };

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /\*\*(.+?)\*\*|\[(n\d{1,2})\]/g;
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ type: "bold", text: m[1] });
    else out.push({ type: "cite", ref: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of source.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const lines = chunk.split("\n").filter((l) => l.trim());
    if (lines.length === 0) continue;

    let paragraph: Inline[][] = [];
    let list: Inline[][] = [];
    const flushParagraph = () => {
      if (paragraph.length) blocks.push({ type: "paragraph", lines: paragraph });
      paragraph = [];
    };
    const flushList = () => {
      if (list.length) blocks.push({ type: "list", items: list });
      list = [];
    };

    for (const line of lines) {
      const item = line.match(/^\s*[-*•]\s+(.*)$/);
      if (item) {
        flushParagraph();
        list.push(parseInline(item[1]));
      } else {
        flushList();
        paragraph.push(parseInline(line.replace(/^#+\s*/, "")));
      }
    }
    flushParagraph();
    flushList();
  }
  return blocks;
}
