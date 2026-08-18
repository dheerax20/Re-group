import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The `state` parameter Slack's OAuth flow round-trips for us.
 *
 * Two jobs: prove the callback corresponds to an authorize request this app
 * actually issued (CSRF protection — without this, an attacker could trick a
 * signed-in admin into completing an OAuth flow that connects the attacker's
 * Slack workspace to the admin's church site), and carry `siteId` through the
 * redirect, since Slack's callback gets no other context about which site
 * initiated the install.
 *
 * Stateless by design — no server-side row to store and clean up. The
 * signature (keyed by `SLACK_CLIENT_SECRET`, which only this deployment
 * knows) is what makes it unforgeable; the embedded expiry is what bounds how
 * long a captured state value would remain useful to replay.
 */

const STATE_TTL_MS = 10 * 60 * 1000;

function signingKey(): string {
  const secret = process.env.SLACK_CLIENT_SECRET;
  if (!secret) {
    throw new Error("SLACK_CLIENT_SECRET is not set — required for the Slack OAuth flow.");
  }
  return secret;
}

function base64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function signOAuthState(siteId: string): string {
  const payload = base64url(JSON.stringify({ siteId, exp: Date.now() + STATE_TTL_MS }));
  const signature = createHmac("sha256", signingKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyOAuthState(token: string): { siteId: string } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = createHmac("sha256", signingKey()).update(payload).digest("base64url");

  // Both sides are already base64url — same charset, so comparing as UTF-8
  // buffers is safe and avoids a length mismatch throwing before the
  // constant-time comparison even runs.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(fromBase64url(payload)) as { siteId?: unknown; exp?: unknown };
    if (typeof parsed.siteId !== "string" || typeof parsed.exp !== "number") return null;
    if (Date.now() > parsed.exp) return null;
    return { siteId: parsed.siteId };
  } catch {
    return null;
  }
}
