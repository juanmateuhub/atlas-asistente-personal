import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** 32-byte key, base64. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" */
function key(): Buffer {
  const raw = process.env.MAIL_TOKEN_KEY;
  const k = raw ? Buffer.from(raw, "base64") : null;
  if (!k || k.length !== 32) throw new Error("Falta MAIL_TOKEN_KEY (32 bytes en base64) en .env.local");
  return k;
}

/** AES-256-GCM: "iv.tag.ciphertext" in base64url. */
export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".");
}

export function decryptToken(sealed: string): string {
  const [iv, tag, ct] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
