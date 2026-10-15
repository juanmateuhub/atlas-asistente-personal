export const FILTER_FIELDS = ["subject", "from", "any"] as const;
export type FilterField = (typeof FILTER_FIELDS)[number];

export const FIELD_LABEL: Record<FilterField, string> = {
  subject: "Asunto",
  from: "Remitente",
  any: "Asunto o remitente",
};

export type MailFilter = { id: string; field: FilterField; pattern: string };

/** Created when the account is first connected; the user can remove them. */
export const DEFAULT_FILTERS: Omit<MailFilter, "id">[] = [
  { field: "subject", pattern: "Inici de sessió nou" },
  { field: "any", pattern: "Enquestes UJI" },
  { field: "subject", pattern: "Heu realitzat la tramesa" },
];

export const PATTERN_MIN = 2;
export const PATTERN_MAX = 120;

/** Lower case, no accents, single spaces: "Sessió  NOU" → "sessio nou". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** The first filter that hides this message, or null if it should be shown. */
export function matchingFilter(
  message: { subject: string; from: string },
  filters: MailFilter[],
): MailFilter | null {
  const subject = normalize(message.subject);
  const from = normalize(message.from);
  for (const f of filters) {
    const p = normalize(f.pattern);
    if (!p) continue;
    if ((f.field !== "from" && subject.includes(p)) || (f.field !== "subject" && from.includes(p))) return f;
  }
  return null;
}

export type FilterInput = { field: FilterField; pattern: string };

export function parseFilterInput(fd: FormData): { ok: true; value: FilterInput } | { ok: false; error: string } {
  const field = fd.get("field");
  const pattern = String(fd.get("pattern") ?? "").replace(/\s+/g, " ").trim();
  if (typeof field !== "string" || !FILTER_FIELDS.includes(field as FilterField)) {
    return { ok: false, error: "Elige dónde buscar el texto." };
  }
  if (pattern.length < PATTERN_MIN) return { ok: false, error: `Escribe al menos ${PATTERN_MIN} caracteres.` };
  if (pattern.length > PATTERN_MAX) return { ok: false, error: `El texto no puede pasar de ${PATTERN_MAX} caracteres.` };
  return { ok: true, value: { field: field as FilterField, pattern } };
}
