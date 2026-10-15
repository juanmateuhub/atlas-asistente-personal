/**
 * Email HTML in a sandboxed iframe: no scripts, no forms, no same-origin access.
 * The CSP allows remote images (https) so messages render as in Gmail; everything
 * else external stays blocked. Links open in a new tab.
 */
export function MailBody({ html, text }: { html: string | null; text: string | null }) {
  if (!html) {
    return (
      <div className="rounded-[18px] bg-surface p-6 text-[15px] leading-[1.6] whitespace-pre-wrap text-neutral-200 [overflow-wrap:anywhere]">
        {text?.trim() || "Este correo no tiene texto."}
      </div>
    );
  }

  const csp = "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src https: data: cid:";
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>body{margin:0;padding:24px;font:15px/1.55 system-ui,sans-serif;color:#1d1d24;background:#fff;overflow-wrap:anywhere}img{max-width:100%;height:auto}</style></head><body>${html}</body></html>`;

  return (
    <iframe
      title="Contenido del correo"
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      srcDoc={doc}
      className="h-[70dvh] w-full rounded-[22px] bg-white"
    />
  );
}
