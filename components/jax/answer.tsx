import { FileText, Mail } from "lucide-react";
import Link from "next/link";
import type { Citation } from "@/lib/jax/context";
import { parseMarkdown, type Inline } from "@/lib/jax/markdown";

/** Note pages open in the editor; uploaded documents open the file itself; emails open in Correo. */
const pageHref = (c: Citation) =>
  c.kind === "file"
    ? `/api/archivos/${c.pageId}`
    : c.kind === "mail"
      ? `/correo/${c.pageId}`
      : `/universidad/${c.subjectId}/paginas/${c.pageId}`;

/** Documents are served by an API route (signed URL): open them in a new tab, not via client navigation. */
function SourceLink({ citation, ...props }: { citation: Citation } & Omit<React.ComponentProps<"a">, "href">) {
  const href = pageHref(citation);
  return citation.kind === "file" ? (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props} />
  ) : (
    <Link href={href} {...props} />
  );
}

/** Renders a Jax answer (Markdown subset) with linked citations. */
export function Answer({ content, citations }: { content: string; citations: Citation[] }) {
  const byRef = new Map(citations.map((c) => [c.ref, c]));
  const number = (ref: string) => citations.findIndex((c) => c.ref === ref) + 1;

  const inline = (parts: Inline[]) =>
    parts.map((part, i) => {
      if (part.type === "bold") return <strong key={i} className="font-semibold text-ink">{part.text}</strong>;
      if (part.type === "text") return <span key={i}>{part.text}</span>;
      const c = byRef.get(part.ref);
      // While streaming, citations are not validated yet: show nothing.
      if (!c) return null;
      return (
        <SourceLink
          key={i}
          citation={c}
          title={c.title}
          aria-label={`Fuente: ${c.title}`}
          className="mx-0.5 inline-flex size-5 -translate-y-0.5 items-center justify-center rounded-full bg-line/40 align-middle text-caption font-medium text-accent-ink hover:bg-accent hover:text-white"
        >
          {number(part.ref)}
        </SourceLink>
      );
    });

  return (
    <div className="flex flex-col gap-3">
      {parseMarkdown(content).map((block, i) =>
        block.type === "paragraph" ? (
          <p key={i}>
            {block.lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(line)}
              </span>
            ))}
          </p>
        ) : (
          <ul key={i} className="flex list-disc flex-col gap-1 pl-5 marker:text-accent">
            {block.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </ul>
        ),
      )}
      {citations.length > 0 && (
        <ul aria-label="Fuentes" className="flex flex-wrap gap-2 pt-1">
          {citations.map((c, i) => (
            <li key={c.ref}>
              <SourceLink
                citation={c}
                className="pressable inline-flex items-center gap-2 rounded-atlas border border-line px-3 py-1.5 text-xs text-body hover:border-text hover:text-accent"
              >
                <span className="font-medium tabular-nums text-accent-ink">{i + 1}</span>
                {c.kind === "mail" ? <Mail aria-hidden className="size-3.5" /> : <FileText aria-hidden className="size-3.5" />}
                <span className="max-w-48 truncate">{c.title}</span>
              </SourceLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
