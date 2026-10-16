/**
 * Gmail REST helpers (read, marking a message as read, sending what the user confirmed). Parsing is kept pure (and tested); the fetchers
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

// --- sending -------------------------------------------------------------------------

const ADDRESS = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

/** "a@uji.es, b@uji.es" → addresses, or null if any is not a plain address (no names, no header tricks). */
export function parseAddresses(value: string): string[] | null {
  const list = value
    .split(/[,;]/)
    .map((a) => a.trim())
    .filter(Boolean);
  if (list.length === 0 || list.length > 10) return null;
  return list.every((a) => a.length <= 254 && ADDRESS.test(a)) ? list : null;
}

/** RFC 2047 encoded word, so accents survive in the subject. */
function encodeHeader(value: string): string {
  const clean = value.replace(/[\r\n]+/g, " ").trim();
  return /^[\x20-\x7e]*$/.test(clean) ? clean : `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

export type OutgoingMail = {
  to: string[];
  subject: string;
  body: string;
  /** Message-ID of the message being answered, and its References chain. */
  inReplyTo?: string;
  references?: string;
};

/** A plain-text UTF-8 message, base64url as Gmail's `raw` expects. */
export function buildRawMessage(m: OutgoingMail): string {
  const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
  const headers = [
    `To: ${m.to.join(", ")}`,
    `Subject: ${encodeHeader(m.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  if (m.inReplyTo) headers.push(`In-Reply-To: ${oneLine(m.inReplyTo)}`);
  if (m.inReplyTo || m.references) headers.push(`References: ${oneLine([m.references, m.inReplyTo].filter(Boolean).join(" "))}`);
  const body = Buffer.from(m.body.replace(/\r?\n/g, "\r\n"), "utf8")
    .toString("base64")
    .replace(/.{76}/g, "$&\r\n");
  return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${body}`, "utf8").toString("base64url");
}

export type ReplyContext = { threadId: string; to: string; subject: string; messageId: string; references: string };

/** What answering a message needs: who to write to, its thread and its ids. */
export async function getReplyContext(token: string, id: string): Promise<ReplyContext> {
  const fields = ["From", "Reply-To", "Subject", "Message-ID", "References"].map((h) => `metadataHeaders=${h}`).join("&");
  const m = await call<GmailMessage>(token, `/messages/${encodeURIComponent(id)}?format=metadata&${fields}`);
  const headers = m.payload?.headers;
  const replyTo = header(headers, "Reply-To") || header(headers, "From");
  const subject = header(headers, "Subject").trim();
  return {
    threadId: m.threadId,
    to: parseFrom(replyTo.split(",")[0] ?? "").address,
    subject: /^re:/i.test(subject) ? subject : `Re: ${subject}`,
    messageId: header(headers, "Message-ID"),
    references: header(headers, "References"),
  };
}

export async function sendMessage(token: string, raw: string, threadId?: string): Promise<{ id: string }> {
  return call<{ id: string }>(token, "/messages/send", { method: "POST", body: { raw, ...(threadId && { threadId }) } });
}
