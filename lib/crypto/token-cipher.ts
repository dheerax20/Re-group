import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for third-party bearer credentials this app must store in its
 * own database rather than only in env vars.
 *
 * Extracted from `lib/slack/crypto.ts` when GoHighLevel became the second such
 * credential. The wire format is unchanged — `iv:authTag:ciphertext`, hex,
 * with the key derived by SHA-256 over the configured secret — so tokens
 * written by the older Slack-only implementation still decrypt.
 *
 * Authenticated encryption, so a tampered ciphertext fails to decrypt rather
 * than silently returning garbage. Each caller names its own env var: rotating
 * the Slack key must not invalidate every stored GoHighLevel token, and a
 * leaked key must not be leverage over both providers at once.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

export type TokenCipher = {
  encryptToken(plaintext: string): string;
  decryptToken(stored: string): string;
};

export function createTokenCipher(envVar: string, purpose: string): TokenCipher {
  function encryptionKey(): Buffer {
    const secret = process.env[envVar];
    if (!secret) {
      throw new Error(`${envVar} is not set — required to store or read ${purpose}.`);
    }
    // Any length of secret in, a fixed 32-byte key out — one less
    // "must be exactly N bytes, base64" rule for ops to remember.
    return createHash("sha256").update(secret).digest();
  }

  return {
    /** `iv:authTag:ciphertext`, each hex-encoded — safe to store in a `String` column. */
    encryptToken(plaintext: string): string {
      const key = encryptionKey();
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const authTag = cipher.getAuthTag();

      return [iv.toString("hex"), authTag.toString("hex"), ciphertext.toString("hex")].join(
        ":"
      );
    },

    decryptToken(stored: string): string {
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
    },
  };
}
