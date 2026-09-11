import { createTokenCipher } from "@/lib/crypto/token-cipher";

/**
 * Encrypts a Slack bot access token before it is ever written to Postgres.
 *
 * A leaked `SlackConnection` row must not be a leaked ability to post into a
 * church's Slack as their bot, so the token is encrypted with a key that lives
 * only in the deployment environment — reading the database alone is not
 * enough to recover it.
 *
 * The implementation moved to `lib/crypto/token-cipher.ts` when GoHighLevel
 * became the second stored third-party credential; the algorithm, key
 * derivation, and stored format are unchanged, so existing rows still decrypt.
 * This module stays the Slack-facing name for it, and owns which env var holds
 * Slack's key.
 */
const cipher = createTokenCipher("SLACK_TOKEN_ENCRYPTION_KEY", "Slack bot tokens");

/** `iv:authTag:ciphertext`, each hex-encoded — plain text, safe to store in a `String` column. */
export const encryptToken = cipher.encryptToken;
export const decryptToken = cipher.decryptToken;
