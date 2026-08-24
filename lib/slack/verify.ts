import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Proving a request actually came from Slack.
 *
 * These routes are the only unauthenticated write surface this app exposes
 * besides the Stripe webhook: no session, no CSRF token, no Auth0 — a POST
 * from anywhere on the internet that ends in an LLM call and a change to a
 * church's website. The signature is the ONLY thing standing between those
 * two facts, so everything here fails closed.
 *
 * Three rules the callers depend on:
 *
 * 1. The body is read as TEXT, once, before anything else. Slack signs the
 *    exact bytes it sent; `.json()` or `.formData()` consume the stream and
 *    re-encode it, and a re-encoded body produces a different HMAC. This is
 *    also why `proxy.ts` returns these paths before `auth0.middleware()`.
 * 2. Parsing happens strictly AFTER verification. An unverified body is
 *    attacker-controlled input, and there is no reason to parse it at all if
 *    it is going to be thrown away.
 * 3. Nothing here decides what the caller may DO. The verified body names a
 *    team, a user and a channel; `lib/slack/authorize.ts` looks those up and
 *    decides. A signature proves origin, never permission.
 */

/**
 * Slack's own recommendation. Wide enough to absorb clock drift between two
 * hosts, narrow enough that a captured request stops being replayable within
 * minutes.
 */
const MAX_SKEW_SECONDS = 300;

/** Slack signs with this version prefix; anything else is not a signature we understand. */
const SIGNATURE_VERSION = "v0";

export type SlackVerification =
  | { ok: true; rawBody: string }
  | { ok: false; reason: string };

/**
 * Verifies a Slack request and hands back its raw body.
 *
 * `reason` is for the server log only. It is never echoed to the caller: the
 * difference between "bad signature" and "stale timestamp" is a free oracle
 * for anyone probing the endpoint, and a legitimate Slack request never sees
 * these strings anyway.
 */
export async function verifySlackRequest(request: Request): Promise<SlackVerification> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    // Not an attack — a misconfigured deployment. Refusing is still correct:
    // without the secret there is no way to tell the two apart.
    return { ok: false, reason: "signing_secret_not_configured" };
  }

  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");
  if (!timestamp || !signature) {
    return { ok: false, reason: "missing_signature_headers" };
  }

  const sentAt = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(sentAt)) {
    return { ok: false, reason: "malformed_timestamp" };
  }

  /**
   * Both directions, deliberately.
   *
   * Guarding only against old timestamps leaves a request dated an hour into
   * the future replayable for that whole hour once the clock catches up. A
   * far-future timestamp is as suspicious as a stale one, and a real Slack
   * request is never either.
   */
  const skew = Math.abs(Math.floor(Date.now() / 1000) - sentAt);
  if (skew > MAX_SKEW_SECONDS) {
    return { ok: false, reason: "timestamp_outside_window" };
  }

  // Must precede any other read of the body. See rule 1 above.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return { ok: false, reason: "unreadable_body" };
  }

  /**
   * Note `timestamp`, the RAW header, not the parsed `sentAt`.
   *
   * Slack computes its signature over the literal bytes it sent. Re-rendering
   * the number would silently disagree the moment the header is anything
   * `parseInt` normalises away — a leading zero, a plus sign, trailing
   * whitespace — and produce a signature mismatch on a genuine request.
   * `sentAt` is for the freshness window only.
   */
  const expected =
    `${SIGNATURE_VERSION}=` +
    createHmac("sha256", signingSecret)
      .update(`${SIGNATURE_VERSION}:${timestamp}:${rawBody}`)
      .digest("hex");

  if (!constantTimeEquals(signature, expected)) {
    return { ok: false, reason: "signature_mismatch" };
  }

  return { ok: true, rawBody };
}

/**
 * `timingSafeEqual` THROWS on a length mismatch rather than returning false,
 * so the length is compared first — which leaks only the length of a value
 * the attacker already supplied. Same shape as `verifyOAuthState` in
 * `./state.ts`.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Where a slash command's reply may be sent.
 *
 * The signature already proves this body came from Slack, so this is defence
 * in depth: `response_url` is a URL taken from a request payload that the app
 * then POSTs to, which is the exact shape of an SSRF. Pinning the host means a
 * leaked signing secret buys an attacker a forged command, not a request
 * origination primitive pointed at internal infrastructure.
 */
const RESPONSE_URL_HOST = "hooks.slack.com";

function isSlackResponseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === RESPONSE_URL_HOST;
  } catch {
    return false;
  }
}

export type SlackCommandBody = {
  teamId: string;
  userId: string;
  channelId: string;
  /** Display only — Slack sends "privategroup" for private channels. */
  channelName: string | null;
  command: string;
  /** Everything the user typed after the command. Unparsed. */
  text: string;
  responseUrl: string;
  triggerId: string | null;
};

/**
 * Parses a slash-command payload. Call ONLY on a verified body.
 *
 * Returns null rather than a partial object when a field the authorization
 * step depends on is absent — a command with no team or no channel cannot be
 * authorized, so there is nothing useful to do with it.
 */
export function parseCommandBody(rawBody: string): SlackCommandBody | null {
  const form = new URLSearchParams(rawBody);

  const teamId = form.get("team_id");
  const userId = form.get("user_id");
  const channelId = form.get("channel_id");
  const command = form.get("command");
  const responseUrl = form.get("response_url");

  if (!teamId || !userId || !channelId || !command || !responseUrl) return null;
  if (!isSlackResponseUrl(responseUrl)) return null;

  return {
    teamId,
    userId,
    channelId,
    channelName: form.get("channel_name") || null,
    command,
    text: form.get("text") ?? "",
    responseUrl,
    triggerId: form.get("trigger_id") || null,
  };
}

/**
 * The two event shapes this app subscribes to.
 *
 * `url_verification` is the one-time handshake Slack performs when an events
 * URL is saved; `event_callback` wraps everything else. Anything else Slack
 * invents later parses to null and the route answers 200 — acknowledging an
 * event we do not handle is correct, since Slack retries anything else.
 */
export type SlackEventEnvelope =
  | { type: "url_verification"; challenge: string }
  | {
      type: "event_callback";
      teamId: string;
      eventType: string;
      /**
       * The inner event, untyped on purpose. Each event Slack sends has its
       * own shape, and knowing those shapes is the ROUTE's job — the parser's
       * job is only to prove there is a team and an event type to dispatch on.
       */
      event: Record<string, unknown>;
    };

/** Parses an events payload. Call ONLY on a verified body. */
export function parseEventBody(rawBody: string): SlackEventEnvelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const body = parsed as Record<string, unknown>;

  if (body.type === "url_verification") {
    return typeof body.challenge === "string"
      ? { type: "url_verification", challenge: body.challenge }
      : null;
  }

  if (body.type === "event_callback") {
    const event =
      typeof body.event === "object" && body.event !== null
        ? (body.event as Record<string, unknown>)
        : null;

    if (typeof body.team_id !== "string" || typeof event?.type !== "string") return null;
    return {
      type: "event_callback",
      teamId: body.team_id,
      eventType: event.type,
      event,
    };
  }

  return null;
}

export type SlackInteraction = {
  teamId: string;
  userId: string;
  channelId: string;
  /** The message the button lives on, so it can be rewritten in place. */
  messageTs: string | null;
  responseUrl: string;
  actionId: string;
  /** Whatever the button carried — for Undo, the job id. */
  value: string | null;
};

/**
 * Parses a Block Kit interaction. Call ONLY on a verified body.
 *
 * Interactivity arrives form-encoded with a single `payload` field holding
 * JSON, which is why it needs its own parser rather than reusing either of
 * the two above.
 *
 * Only the first action is read. Slack sends an array because a single
 * submission can carry several inputs, but every interactive element this app
 * publishes is a lone button.
 */
export function parseInteractionBody(rawBody: string): SlackInteraction | null {
  const raw = new URLSearchParams(rawBody).get("payload");
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const body = parsed as Record<string, unknown>;

  // Anything else — a modal submission, a shortcut — is not something this
  // app publishes, so there is nothing to dispatch on.
  if (body.type !== "block_actions") return null;

  const teamId = idOf(body.team);
  const userId = idOf(body.user);
  const channelId = idOf(body.channel);
  const responseUrl = typeof body.response_url === "string" ? body.response_url : null;

  if (!teamId || !userId || !channelId || !responseUrl) return null;
  if (!isSlackResponseUrl(responseUrl)) return null;

  const action = Array.isArray(body.actions) ? body.actions[0] : null;
  if (!action || typeof action !== "object") return null;
  const actionId = (action as Record<string, unknown>).action_id;
  if (typeof actionId !== "string") return null;

  const message = body.message;
  const messageTs =
    typeof message === "object" && message !== null
      ? ((message as Record<string, unknown>).ts as string | undefined)
      : undefined;

  const value = (action as Record<string, unknown>).value;

  return {
    teamId,
    userId,
    channelId,
    messageTs: typeof messageTs === "string" ? messageTs : null,
    responseUrl,
    actionId,
    value: typeof value === "string" && value ? value : null,
  };
}

function idOf(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const id = (value as Record<string, unknown>).id;
  return typeof id === "string" && id ? id : null;
}
