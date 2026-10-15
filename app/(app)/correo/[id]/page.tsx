import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowSquareOut, CaretLeft, Paperclip } from "@phosphor-icons/react/ssr";
import { Suspense } from "react";
import { MailBody } from "@/components/mail/mail-body";
import { MailToItem } from "@/components/mail/mail-to-item";
import { gmailUrl, messageDate } from "@/lib/mail/format";
import { GmailError, getMessage, isMessageId, type MailMessage } from "@/lib/mail/gmail";
import { ReconnectError } from "@/lib/mail/google";
import { getMailAccessToken, getMailAccount } from "@/lib/mail/queries";
import { todayIn } from "@/lib/tasks/dates";

export const metadata: Metadata = { title: "Correo" };

export default function MensajePage({ params }: PageProps<"/correo/[id]">) {
  return (
    <div className="animate-rise">
      <Link
        href="/correo"
        className="mb-6 inline-flex items-center gap-1 rounded-full py-1 pr-3 pl-2 text-[13px] font-medium text-neutral-400 transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_6%,transparent)] hover:text-neutral-200"
      >
        <CaretLeft size={14} />
        Correo
      </Link>
      <Suspense fallback={<div aria-hidden className="h-[60dvh] animate-skeleton rounded-[18px] bg-surface/60" />}>
        <Message params={params} />
      </Suspense>
    </div>
  );
}

async function Message({ params }: Pick<PageProps<"/correo/[id]">, "params">) {
  await connection();
  const { id } = await params;
  if (!isMessageId(id)) notFound();

  const account = await getMailAccount();
  if (!account) redirect("/correo");

  let message: MailMessage;
  try {
    message = await getMessage(await getMailAccessToken(account), id);
  } catch (err) {
    if (err instanceof ReconnectError) redirect("/correo");
    if (err instanceof GmailError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }

  const link = gmailUrl(account.email, message.id);
  const from = message.fromName === message.fromAddress ? message.fromAddress : `${message.fromName} <${message.fromAddress}>`;

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <h1 className="m-0 text-[clamp(26px,3.4vw,36px)] leading-[1.15] tracking-[-0.03em] [overflow-wrap:anywhere]">
          {message.subject}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px]">
          <span
            aria-hidden
            className="grid size-9 flex-none place-items-center rounded-full text-[14px] font-medium text-accent-200"
            style={{ background: "radial-gradient(circle at 30% 20%, var(--color-accent-700), var(--color-accent-900) 70%)" }}
          >
            {message.fromName.charAt(0).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{message.fromName}</span>
            <span className="truncate text-[12.5px] text-neutral-500">
              {message.fromAddress !== message.fromName && `${message.fromAddress} · `}
              {messageDate(message.date)}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MailToItem subject={message.subject} from={from} link={link} today={todayIn(new Date())} />
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-[6px] rounded-full px-3 py-[5px] text-[13px] font-medium text-accent transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]"
          >
            Abrir en Gmail
            <ArrowSquareOut size={14} />
          </a>
        </div>
      </header>

      {message.attachments.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Adjuntos">
          {message.attachments.map((name, i) => (
            <li
              key={`${name}-${i}`}
              className="inline-flex max-w-full items-center gap-[6px] rounded-full bg-surface px-3 py-[5px] text-[12.5px] text-neutral-300"
              style={{ boxShadow: "0 0 0 1px color-mix(in srgb, var(--color-text) 6%, transparent)" }}
            >
              <Paperclip size={13} />
              <span className="truncate">{name}</span>
            </li>
          ))}
        </ul>
      )}

      <MailBody html={message.html} text={message.text} />
    </article>
  );
}
