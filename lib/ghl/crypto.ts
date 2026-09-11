import { createTokenCipher } from "@/lib/crypto/token-cipher";

/**
 * Encrypts GoHighLevel OAuth tokens before they are written to Postgres.
 *
 * A `ghl_oauth_tokens` row grants access to a church's contacts and
 * conversations, and the agency row grants it across every sub-account this
 * platform has ever created — a strictly larger blast radius than the Slack
 * token this pattern was built for. Its own key, so rotating one provider's
 * secret does not invalidate the other's stored tokens.
 */
const cipher = createTokenCipher(
  "GHL_TOKEN_ENCRYPTION_KEY",
  "GoHighLevel OAuth tokens"
);

export const encryptToken = cipher.encryptToken;
export const decryptToken = cipher.decryptToken;
