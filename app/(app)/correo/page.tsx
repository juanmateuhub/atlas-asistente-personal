import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowClockwise, EnvelopeSimple, EyeSlash, GoogleLogo, WarningCircle } from "@phosphor-icons/react/ssr";
import { Suspense } from "react";
import { DisconnectButton } from "@/components/mail/disconnect-button";
import { FiltersPanel } from "@/components/mail/filters-panel";
import { FiltersSheet } from "@/components/mail/filters-sheet";
import { InboxRow } from "@/components/mail/inbox-row";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { matchingFilter } from "@/lib/mail/filters";
import { inboxDate } from "@/lib/mail/format";
import { listInbox, type MailSummary } from "@/lib/mail/gmail";
import { ReconnectError, mailConfigured } from "@/lib/mail/google";
import { getMailAccessToken, getMailAccount, listMailFilters } from "@/lib/mail/queries";

export const metadata: Metadata = { title: "Correo" };

const NOTICES: Record<string, string> = {
  cancelado: "Has cancelado la conexión con Google.",
  error: "No se ha podido conectar con Google. Inténtalo de nuevo.",
  "sin-configurar": "Falta configurar la conexión con Google en el servidor.",
};

export default function CorreoPage({ searchParams }: PageProps<"/correo">) {
  return (
    <div className="animate-rise">
      <div className="mb-12">
        <PageHeader title="Correo" lead="Tu correo de la UJI, sin el ruido." />
      </div>
      <Suspense fallback={<Skeleton />}>
        <Inbox searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Inbox({ searchParams }: Pick<PageProps<"/correo">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const aviso = typeof params.aviso === "string" ? NOTICES[params.aviso] : undefined;
  const pageToken = typeof params.pagina === "string" && /^[\w-]{1,200}$/.test(params.pagina) ? params.pagina : undefined;
  const showHidden = params.ocultos === "1";

  const account = await getMailAccount();
  if (!account) return <Connect notice={aviso} configured={mailConfigured()} />;

  let page: { messages: MailSummary[]; nextPageToken: string | null };
  const filters = await listMailFilters();
  try {
    page = await listInbox(await getMailAccessToken(account), pageToken);
  } catch (err) {
    if (err instanceof ReconnectError) {
      return <Connect notice="Google ha caducado el acceso. Vuelve a conectar tu correo." configured reconnect />;
    }
    // Still connected: a temporary Gmail failure must not look like a sign-out.
    return (
      <div className="flex max-w-xl flex-col items-start gap-3">
        <p role="alert" className="m-0 flex items-center gap-2 text-[14px] text-neutral-300">
          <WarningCircle size={18} color="var(--color-accent-ink)" />
          Gmail no ha respondido. Tu correo sigue conectado.
        </p>
        <Link
          href="/correo"
          className="pressable inline-flex h-[40px] items-center gap-2 rounded-full bg-step px-4 text-[14px] font-medium"
        >
          <ArrowClockwise size={15} />
          Reintentar
        </Link>
      </div>
    );
  }

  const now = new Date();
  const rows = page.messages.map((m) => ({ ...m, hiddenBy: matchingFilter({ subject: m.subject, from: `${m.fromName} ${m.fromAddress}` }, filters) }));
  const hidden = rows.filter((r) => r.hiddenBy).length;
  const visible = showHidden ? rows : rows.filter((r) => !r.hiddenBy);
  const href = ({ hidden = showHidden, token = pageToken }: { hidden?: boolean; token?: string | null }) => {
    const q = new URLSearchParams();
    if (hidden) q.set("ocultos", "1");
    if (token) q.set("pagina", token);
    return `/correo${q.size ? `?${q}` : ""}`;
  };

  return (
    <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]">
      <section aria-labelledby="inbox-title" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="inbox-title" className="m-0 text-[20px] tracking-[-0.015em]">
            Bandeja de entrada
          </h2>
          <div className="flex items-center gap-1">
            <FiltersSheet filters={filters} hiddenCount={hidden} email={account.email} />
            {hidden > 0 && (
              <Link
                href={href({ hidden: !showHidden })}
                scroll={false}
                className="inline-flex items-center gap-[6px] rounded-full px-3 py-[5px] text-[13px] font-medium text-accent-ink transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]"
              >
                <EyeSlash size={15} />
                {showHidden ? "Ocultar filtrados" : `Ver ${hidden} filtrados`}
              </Link>
            )}
            <Link
              href={href({})}
              aria-label="Actualizar"
              title="Actualizar"
              className="pressable grid size-[34px] place-items-center rounded-full text-neutral-400 transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] hover:text-neutral-200"
            >
              <ArrowClockwise size={16} />
            </Link>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="m-0 py-6 text-[15px] text-neutral-500">No hay correos que mostrar.</p>
        ) : (
          <ul className="mx-[-14px] flex flex-col">
            {visible.map((m, i) => (
              <li key={m.id} className="animate-pop" style={{ animationDelay: `${Math.min(i, 12) * 0.025}s` }}>
                <InboxRow
                  m={{
                    id: m.id,
                    fromName: m.fromName,
                    subject: m.subject,
                    snippet: m.snippet,
                    date: inboxDate(m.date, now),
                    unread: m.unread,
                    hiddenBy: m.hiddenBy?.pattern ?? null,
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2 pt-2">
          {pageToken && (
            <Link href={href({ token: null })} className="rounded-full px-3 py-[5px] text-[13px] font-medium text-accent-ink hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]">
              Volver al principio
            </Link>
          )}
          {page.nextPageToken && (
            <Link href={href({ token: page.nextPageToken })} className="rounded-full px-3 py-[5px] text-[13px] font-medium text-accent-ink hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]">
              Correos más antiguos
            </Link>
          )}
        </div>
      </section>

      <aside className="hidden flex-col gap-4 lg:sticky lg:top-6 lg:flex">
        <FiltersPanel filters={filters} hiddenCount={hidden} />
        {/* div, not p: DisconnectButton renders a <dialog>, which a <p> cannot contain. */}
        <div className="flex flex-wrap items-center gap-x-2 px-1 text-[12.5px] text-neutral-500">
          <EnvelopeSimple size={14} />
          <span className="truncate">{account.email}</span>
          <span aria-hidden>·</span>
          <DisconnectButton email={account.email} />
        </div>
      </aside>
    </div>
  );
}

function Connect({ notice, configured, reconnect = false }: { notice?: string; configured: boolean; reconnect?: boolean }) {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      {notice && (
        <p role="alert" className="m-0 flex items-center gap-2 text-[14px] text-neutral-300">
          <WarningCircle size={18} color="var(--color-accent-ink)" />
          {notice}
        </p>
      )}
      <EmptyState
        icon={<EnvelopeSimple size={20} weight="fill" />}
        title={reconnect ? "Vuelve a conectar tu correo" : "Conecta tu correo de la UJI"}
        description="Atlas lee tu bandeja y marca como leídos los correos que abres. No envía ni borra correos. Los avisos automáticos que no te interesan se ocultan con filtros que tú controlas."
      />
      {configured ? (
        // Plain <a>: the route redirects to Google, it is not an app page.
        <a
          href="/api/correo/conectar"
          className="pressable inline-flex h-[44px] items-center gap-2 self-start rounded-full bg-accent px-5 text-[15px] font-semibold text-on-accent transition-[background,scale] hover:bg-accent-500"
        >
          <GoogleLogo size={16} weight="bold" />
          Conectar con Google
        </a>
      ) : (
        <p className="m-0 text-[13px] text-neutral-500">
          Faltan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o MAIL_TOKEN_KEY en el servidor.
        </p>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]">
      <div className="flex flex-col gap-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 animate-skeleton rounded-[14px] bg-step" />
        ))}
      </div>
      <div className="h-72 animate-skeleton rounded-[20px] bg-step" />
    </div>
  );
}
