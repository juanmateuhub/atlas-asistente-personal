import { keywords, normalize } from "./search";

/**
 * When does a question need the mailbox? Reading Gmail costs a token refresh and
 * several API calls, so Jax only looks when the user talks about mail.
 */
const MAIL_WORDS = new Set(
  (
    "correo correos email emails mail mails gmail bandeja mensaje mensajes escrito escribio escribieron " +
    "enviado enviaron mandado mandaron llegado llego recibido recibi notificacion notificaciones"
  ).split(" "),
);

/** Words that say *which* mail ("el último correo") but are useless as Gmail search terms. */
const GENERIC = new Set(
  (
    "ultimo ultimos ultima ultimas reciente recientes nuevo nuevos nueva nuevas hoy ayer semana leido leer " +
    "algun alguno alguna importante importantes tengo dice dicen sobre profesor profe uji"
  ).split(" "),
);

export function wantsMail(question: string): boolean {
  const words = normalize(question).match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.some((w) => MAIL_WORDS.has(w));
}

/**
 * Gmail search query for the question: its meaningful words, any of them
 * (`{a b}` is OR in Gmail). Empty when nothing specific is asked; then Jax reads
 * the latest messages in the inbox instead.
 */
export function mailQuery(question: string): string {
  const terms = keywords(question)
    .filter((w) => !MAIL_WORDS.has(w) && !GENERIC.has(w))
    .slice(0, 6);
  return terms.length ? `{${terms.join(" ")}}` : "";
}
