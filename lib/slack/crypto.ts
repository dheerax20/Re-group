import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encrypts a Slack bot access token before it is ever written to Postgres.
 *
 * This is the first third-party bearer credential this app stores in its own
 * database rather than only in env vars — every other provider secret
 * (Stripe, R2, Clerk) lives in deployment config, never in a table a query
 * could accidentally select and log. A leaked `SlackConnection` row must not
 * be a leaked ability to post into a church's Slack as their bot, so the
 * token is encrypted with a key that lives only in the deployment environment
 * — reading the database alone is not enough to recover it.
 *
 * AES-256-GCM: authenticated encryption, so a tampered ciphertext fails to
 * decrypt rather than silently returning garbage. Built on `node:crypto` —
 * no new dependency, consistent with the rest of this app's crypto (see
 * `lib/billing/sync.ts`'s `createHash`, `lib/storage/r2-provider.ts`'s
 * `randomUUID`).
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function encryptionKey(): Buffer {
  const secret = process.env.SLACK_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "SLACK_TOKEN_ENCRYPTION_KEY is not set — required to store or read Slack bot tokens."
    );
  }
  // Any length of secret in, a fixed 32-byte key out — one less
  // "must be exactly N bytes, base64" rule for ops to remember.
  return createHash("sha256").update(secret).digest();
}

/** `iv:authTag:ciphertext`, each hex-encoded — plain text, safe to store in a `String` column. */
export function encryptToken(plaintext: string): string {
  const key = encryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), ciphertext.toString("hex")].join(":");
}

export function decryptToken(stored: string): string {
  const [ivHex, authTagHex, ciphertextHex] = stored.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted token.");
  }

  const key = encryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
