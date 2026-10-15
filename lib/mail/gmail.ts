/**
 * Read-only Gmail REST helpers. Parsing is kept pure (and tested); the fetchers
 * take a short-lived access token obtained server-side.
 */

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export type GmailHeader = { name: string; value: string };
export type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
};
type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
};

export type MailSummary = {
  id: string;
  subject: string;
  /** Display name, or the address when there is none. */
  fromName: string;
  fromAddress: string;
  /** ISO timestamp. */
  date: string;
  snippet: string;
  unread: boolean;
};

export type MailMessage = MailSummary & {
  html: string | null;
  text: string | null;
  attachments: string[];
};

export class GmailError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function header(headers: GmailHeader[] | undefined, name: string): string {
  const h = headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

/** `"Secretaria UJI" <secre@uji.es>` → name + address. */
export function parseFrom(value: string): { name: string; address: string } {
  const m = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) {
    const address = m[2].trim();
    return { name: m[1].trim() || address, address };
  }
  const address = value.trim();
  return { name: address, address };
}

export function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

/** Gmail snippets come HTML-escaped. */
function unescapeSnippet(s: string): string {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Walks the MIME tree: first text/html and text/plain bodies, plus attachment names. */
export function extractBody(part: GmailPart | undefined): { html: string | null; text: string | null; attachments: string[] } {
  const out = { html: null as string | null, text: null as string | null, attachments: [] as string[] };
  const walk = (p: GmailPart) => {
    if (p.filename) {
      out.attachments.push(p.filename);
      return;
    }
    if (p.body?.data) {
      if (p.mimeType === "text/html" && out.html === null) out.html = decodeBase64Url(p.body.data);
      else if (p.mimeType === "text/plain" && out.text === null) out.text = decodeBase64Url(p.body.data);
    }
    p.parts?.forEach(walk);
  };
  if (part) walk(part);
  return out;
}

export function toSummary(m: GmailMessage): MailSummary {
  const headers = m.payload?.headers;
  const from = parseFrom(header(headers, "From"));
  return {
    id: m.id,
    subject: header(headers, "Subject").trim() || "(Sin asunto)",
    fromName: from.name,
    fromAddress: from.address,
    date: new Date(Number(m.internalDate ?? 0)).toISOString(),
    snippet: unescapeSnippet(m.snippet ?? ""),
    unread: m.labelIds?.includes("UNREAD") ?? false,
  };
}

async function call<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) throw new GmailError(`Gmail ${res.status}`, res.status);
  return (await res.json()) as T;
}

/** One page of the inbox, newest first, with the headers needed for the list. */
export async function listInbox(token: string, pageToken?: string, pageSize = 40) {
  const params = new URLSearchParams({ labelIds: "INBOX", maxResults: String(pageSize) });
  if (pageToken) params.set("pageToken", pageToken);
  const page = await call<{ messages?: { id: string }[]; nextPageToken?: string }>(token, `/messages?${params}`);

  const meta = "format=metadata&metadataHeaders=From&metadataHeaders=Subject";
  const messages = await Promise.all(
    (page.messages ?? []).map((m) => call<GmailMessage>(token, `/messages/${encodeURIComponent(m.id)}?${meta}`)),
  );
  return { messages: messages.map(toSummary), nextPageToken: page.nextPageToken ?? null };
}

export async function getMessage(token: string, id: string): Promise<MailMessage> {
  const m = await call<GmailMessage>(token, `/messages/${encodeURIComponent(id)}?format=full`);
  return { ...toSummary(m), ...extractBody(m.payload) };
}

/** Gmail message ids are hex strings. */
export function isMessageId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8,32}$/i.test(value);
}
