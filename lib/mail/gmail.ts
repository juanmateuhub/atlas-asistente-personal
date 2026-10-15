/**
 * Gmail REST helpers (read, plus marking a message as read). Parsing is kept pure (and tested); the fetchers
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries what Gmail asks to retry: 429 (too many concurrent requests) and 5xx, with backoff. */
async function call<T>(token: string, path: string, init?: { method: "POST"; body: unknown }): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, ...(init && { "Content-Type": "application/json" }) },
      body: init && JSON.stringify(init.body),
      cache: "no-store",
    });
    if (res.ok) return (await res.json()) as T;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 3) throw new GmailError(`Gmail ${res.status}`, res.status);
    await sleep(300 * 2 ** attempt + Math.random() * 200);
  }
}

/** Like Promise.all, but at most `limit` requests in flight: Gmail rejects bursts per user. */
async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** One page of the inbox, newest first, with the headers needed for the list. */
export function listInbox(token: string, pageToken?: string, pageSize = 40) {
  return listMessages(token, { labelIds: "INBOX", pageToken, max: pageSize });
}

/** Gmail search (same syntax as the Gmail search box), newest first. Spam and trash are excluded. */
export async function searchMessages(token: string, q: string, max = 8): Promise<MailSummary[]> {
  return (await listMessages(token, { q, max })).messages;
}

async function listMessages(token: string, opts: { labelIds?: string; q?: string; pageToken?: string; max: number }) {
  const params = new URLSearchParams({ maxResults: String(opts.max) });
  if (opts.labelIds) params.set("labelIds", opts.labelIds);
  if (opts.q) params.set("q", opts.q);
  if (opts.pageToken) params.set("pageToken", opts.pageToken);
  const page = await call<{ messages?: { id: string }[]; nextPageToken?: string }>(token, `/messages?${params}`);

  const meta = "format=metadata&metadataHeaders=From&metadataHeaders=Subject";
  const messages = await mapLimited(page.messages ?? [], 8, (m) =>
    call<GmailMessage>(token, `/messages/${encodeURIComponent(m.id)}?${meta}`),
  );
  return { messages: messages.map(toSummary), nextPageToken: page.nextPageToken ?? null };
}

export async function getMessage(token: string, id: string): Promise<MailMessage> {
  const m = await call<GmailMessage>(token, `/messages/${encodeURIComponent(id)}?format=full`);
  return { ...toSummary(m), ...extractBody(m.payload) };
}

/** Removes the UNREAD label. A 403 means the account was connected with the old read-only permission. */
export async function markRead(token: string, id: string): Promise<void> {
  await call(token, `/messages/${encodeURIComponent(id)}/modify`, { method: "POST", body: { removeLabelIds: ["UNREAD"] } });
}

/** Plain text of a message for Jax: the text/plain part, or the HTML with tags removed. */
export function messageText(m: Pick<MailMessage, "html" | "text">): string {
  if (m.text?.trim()) return m.text.replace(/\s+/g, " ").trim();
  if (!m.html) return "";
  return unescapeSnippet(
    m.html
      .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Gmail message ids are hex strings. */
export function isMessageId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8,32}$/i.test(value);
}
