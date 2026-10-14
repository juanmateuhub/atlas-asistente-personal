/**
 * Deterministic lexical search over note pages: no embeddings, no LLM. Pages are
 * scored by how often the question's meaningful words appear (title counts
 * triple), and a snippet around the first hit is returned.
 */

export type SearchablePage = {
  id: string;
  /** A note page written in Atlas, or an uploaded document. */
  source?: "page" | "file";
  subjectId: string;
  subjectName: string;
  topicTitle: string;
  title: string;
  text: string;
};

export type PageHit = SearchablePage & { score: number; snippet: string };

const STOPWORDS = new Set(
  (
    "que qué cual cuál cuales como cómo cuando cuándo donde dónde para por con sin sobre entre del las los una uno unos unas " +
    "este esta esto estos estas ese esa eso mis tus sus nos les hay tengo tiene tienes son era fue ser estar está están " +
    "más menos muy pero porque desde hasta todo toda todos todas algo nada dime explica explícame resume resumen sabes puedes " +
    "hacer hago tema temas apuntes página páginas"
  ).split(" "),
);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function keywords(question: string): string[] {
  const words = normalize(question).match(/[\p{L}\p{N}]+/gu) ?? [];
  const unique = new Set(words.filter((w) => w.length >= 3 && !STOPWORDS.has(w)));
  return [...unique].slice(0, 12);
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    count++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return count;
}

export function searchPages(pages: SearchablePage[], question: string, limit = 4, snippetChars = 1200): PageHit[] {
  const terms = keywords(question);
  if (terms.length === 0) return [];

  const hits: PageHit[] = [];
  for (const page of pages) {
    const title = normalize(`${page.title} ${page.topicTitle} ${page.subjectName}`);
    const body = normalize(page.text);
    let score = 0;
    let firstHit = -1;
    for (const term of terms) {
      score += countOccurrences(title, term) * 3 + countOccurrences(body, term);
      const at = body.indexOf(term);
      if (at !== -1 && (firstHit === -1 || at < firstHit)) firstHit = at;
    }
    if (score === 0) continue;

    // Normalisation keeps string length for Spanish text, so indices map back.
    const start = Math.max(0, (firstHit === -1 ? 0 : firstHit) - snippetChars / 4);
    const snippet = page.text.slice(start, start + snippetChars).trim();
    hits.push({ ...page, score, snippet: `${start > 0 ? "…" : ""}${snippet}${start + snippetChars < page.text.length ? "…" : ""}` });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Splits a long document into ~size-char chunks on paragraph boundaries. */
export function chunkText(text: string, size = 2500): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const para of text.split(/\n{2,}/)) {
    if (current && current.length + para.length > size) {
      chunks.push(current);
      current = "";
    }
    current = current ? `${current}\n\n${para}` : para;
    while (current.length > size * 1.5) {
      chunks.push(current.slice(0, size));
      current = current.slice(size);
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}
