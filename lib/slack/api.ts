/**
 * Thin client over the handful of Slack Web API calls the connect flow
 * needs. Same shape as `lib/domains/vercel.ts`: every call returns a typed
 * result rather than throwing on a 4xx, because "the install code was
 * already used" or "the token was already revoked" are outcomes the caller
 * has to explain to a person, not exceptions.
 */

const API = "https://slack.com/api";

export function isSlackConfigured(): boolean {
  return Boolean(
    process.env.SLACK_CLIENT_ID &&
      process.env.SLACK_CLIENT_SECRET &&
      process.env.SLACK_SIGNING_SECRET &&
      // `encryptToken()` throws without this, and it throws mid-callback —
      // after the church has already approved the install inside Slack. A
      // deployment holding three of the four vars would advertise Connect
      // and then fail at the one point where failing is most confusing.
      process.env.SLACK_TOKEN_ENCRYPTION_KEY
  );
}

/**
 * The command surface — slash commands, events, interactivity — behind its
 * own flag, so it can be switched off in production without disturbing the
 * connect flow, which keeps working exactly as it does today. Unsetting this
 * is the kill switch.
 */
export function isSlackCommandsEnabled(): boolean {
  return isSlackConfigured() && process.env.SLACK_COMMANDS_ENABLED === "1";
}

/**
 * The ONE redirect URI.
 *
 * Slack requires the `redirect_uri` sent to `oauth.v2.access` to match the
 * one on the authorize URL byte-for-byte. Deriving it two ways — an env var
 * when building the authorize link, `request.nextUrl.origin` when exchanging
 * the code — agrees in production and diverges behind a tunnel or a proxy,
 * failing the exchange with `bad_redirect_uri`. Both callers read this.
 */
export function slackRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/api/slack/oauth/callback`;
}

export type SlackResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Reads a Slack response body, returning null rather than throwing.
 *
 * Slack's own API always answers JSON — but the things in front of it do not.
 * A 502 from a proxy, a maintenance page, an empty body: `response.json()`
 * throws a `SyntaxError` on all of them, and every function in this module
 * promises a result instead of an exception. Letting one escape turns a
 * transient blip into a 500 in the OAuth callback, and puts
 * `Unexpected token '<' ...` in front of a church as the explanation for why
 * their edit failed.
 */
async function readSlackJson<T>(response: Response, path: string): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch (error) {
    console.error(`[slack] ${path} returned a non-JSON response (${response.status})`, error);
    return null;
  }
}

async function call<T>(path: string, body: Record<string, string>): Promise<SlackResult<T>> {
  let response: Response;
  try {
    response = await fetch(`${API}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
      cache: "no-store",
    });
  } catch (error) {
    console.error(`[slack] request to ${path} failed`, error);
    return { ok: false, error: "network_error" };
  }

  const json = await readSlackJson<{ ok: boolean; error?: string } & Record<string, unknown>>(
    response,
    path
  );
  if (!json) return { ok: false, error: "invalid_response" };

  // Slack's API always answers 200 and puts success/failure in the body,
  // never in the HTTP status — checking `json.ok` is the only correct check.
  if (!json.ok) {
    return { ok: false, error: json.error ?? "unknown_error" };
  }

  return { ok: true, data: json as T };
}

export type OAuthExchangeResult = {
  accessToken: string;
  botUserId: string;
  teamId: string;
  teamName: string;
  /**
   * `authed_user.id` — the Slack account that approved the install.
   *
   * Present even though this app requests NO user scopes: only the nested
   * `access_token`/`scope` need those. That is what makes binding a single
   * editing identity free, rather than costing a broader consent screen.
   * Still optional in Slack's own type, so it is nullable here and the
   * callback refuses an install that arrives without it.
   */
  authedUserId: string | null;
  /** Bot scopes actually granted, comma-separated as Slack returns them. */
  scopes: string;
  /**
   * The channel the installer picked, from the `incoming-webhook` scope's
   * consent screen. The webhook URL itself is deliberately DISCARDED: a
   * webhook post returns no message `ts`, so a message sent that way could
   * never be `chat.update`d as the edit progresses.
   */
  channel: { id: string; name: string } | null;
};

/** Exchanges the one-time `code` from the OAuth redirect for a bot token. */
export async function exchangeOAuthCode(
  code: string,
  redirectUri: string
): Promise<SlackResult<OAuthExchangeResult>> {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { ok: false, error: "slack_not_configured" };
  }

  const result = await call<{
    access_token: string;
    bot_user_id: string;
    scope?: string;
    team: { id: string; name: string };
    authed_user?: { id?: string };
    incoming_webhook?: { channel?: string; channel_id?: string };
  }>("oauth.v2.access", {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  if (!result.ok) return result;

  const webhook = result.data.incoming_webhook;
  const channelId = webhook?.channel_id;

  return {
    ok: true,
    data: {
      accessToken: result.data.access_token,
      botUserId: result.data.bot_user_id,
      teamId: result.data.team.id,
      teamName: result.data.team.name,
      authedUserId: result.data.authed_user?.id ?? null,
      scopes: result.data.scope ?? "",
      // Both halves or neither — a channel id with no name would render as a
      // blank channel in the settings panel.
      channel: channelId ? { id: channelId, name: webhook?.channel ?? channelId } : null,
    },
  };
}

/**
 * Confirms a freshly stored token actually works.
 *
 * Cheap, and it moves the discovery of a broken install from "the church runs
 * their first command and nothing happens" to "the connect flow says it did
 * not work". Uses the token directly rather than the app credentials, which is
 * the point — it proves the encrypt/decrypt round trip too.
 */
export async function authTest(
  accessToken: string
): Promise<SlackResult<{ teamId: string; botUserId: string }>> {
  let response: Response;
  try {
    response = await fetch(`${API}/auth.test`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch (error) {
    console.error("[slack] auth.test failed", error);
    return { ok: false, error: "network_error" };
  }

  const json = await readSlackJson<{
    ok: boolean;
    team_id?: string;
    user_id?: string;
    error?: string;
  }>(response, "auth.test");
  if (!json) return { ok: false, error: "invalid_response" };
  if (!json.ok) return { ok: false, error: json.error ?? "unknown_error" };

  return {
    ok: true,
    data: { teamId: json.team_id ?? "", botUserId: json.user_id ?? "" },
  };
}

/**
 * A Block Kit block. Opaque here on purpose — `lib/slack/blocks.ts` owns what
 * these look like; this module only has to put them on the wire.
 */
export type SlackBlock = Record<string, unknown>;

/**
 * A JSON call authorized as the bot.
 *
 * Separate from `call()` because the two have genuinely different shapes: the
 * OAuth exchange is form-encoded and authenticates with the app's client
 * credentials in the body, while every messaging method is a Bearer token and
 * a JSON body — and Block Kit blocks cannot survive form encoding anyway.
 */
async function callAsBot<T>(
  path: string,
  accessToken: string,
  payload: Record<string, unknown>
): Promise<SlackResult<T>> {
  let response: Response;
  try {
    response = await fetch(`${API}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (error) {
    console.error(`[slack] request to ${path} failed`, error);
    return { ok: false, error: "network_error" };
  }

  const json = await readSlackJson<{ ok: boolean; error?: string } & Record<string, unknown>>(
    response,
    path
  );
  if (!json) return { ok: false, error: "invalid_response" };
  if (!json.ok) return { ok: false, error: json.error ?? "unknown_error" };
  return { ok: true, data: json as T };
}

/**
 * Posts a message as the bot and returns its `ts`.
 *
 * That `ts` is the whole point: it is what `updateMessage` needs to edit this
 * message in place as the edit progresses, and it is why the install's
 * incoming-webhook URL is discarded rather than used — a webhook post returns
 * no `ts` at all, so a message sent that way could never be updated.
 *
 * `text` is not optional even when `blocks` are supplied: it is what Slack
 * shows in notifications and in clients that cannot render the blocks.
 */
export async function postMessage(
  accessToken: string,
  channel: string,
  text: string,
  blocks?: SlackBlock[]
): Promise<SlackResult<{ ts: string }>> {
  const result = await callAsBot<{ ts: string }>("chat.postMessage", accessToken, {
    channel,
    text,
    ...(blocks ? { blocks } : {}),
  });
  if (!result.ok) return result;
  return { ok: true, data: { ts: result.data.ts } };
}

/** Edits a message this app posted. `ts` must be one of ours. */
export async function updateMessage(
  accessToken: string,
  channel: string,
  ts: string,
  text: string,
  blocks?: SlackBlock[]
): Promise<SlackResult<{ ts: string }>> {
  const result = await callAsBot<{ ts: string }>("chat.update", accessToken, {
    channel,
    ts,
    text,
    ...(blocks ? { blocks } : {}),
  });
  if (!result.ok) return result;
  return { ok: true, data: { ts: result.data.ts } };
}

/**
 * A message only one person sees, and which leaves nothing in the channel.
 *
 * Every refusal uses this rather than a channel post: "you are not the bound
 * account" is between Regroup and the person who typed the command, not
 * something to publish to everyone who can read the channel.
 */
export async function postEphemeral(
  accessToken: string,
  channel: string,
  user: string,
  text: string,
  blocks?: SlackBlock[]
): Promise<SlackResult<unknown>> {
  return callAsBot<unknown>("chat.postEphemeral", accessToken, {
    channel,
    user,
    text,
    ...(blocks ? { blocks } : {}),
  });
}

/**
 * Replies through the `response_url` a slash command carried.
 *
 * Needs no token, which is exactly why it is the right tool for a refusal:
 * some refusals happen when there is no usable connection to read a token
 * from. The URL is validated as a Slack host at parse time
 * (`./verify.ts`), because this is a URL from a request payload that we POST
 * to.
 */
export async function respondViaResponseUrl(
  responseUrl: string,
  text: string,
  blocks?: SlackBlock[]
): Promise<SlackResult<unknown>> {
  try {
    const response = await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        response_type: "ephemeral",
        text,
        ...(blocks ? { blocks } : {}),
      }),
      cache: "no-store",
    });

    // Unlike the Web API, this endpoint answers with a plain status and a
    // body of "ok", so the HTTP status is the only signal there is.
    if (!response.ok) {
      return { ok: false, error: `response_url_${response.status}` };
    }
    return { ok: true, data: null };
  } catch (error) {
    console.error("[slack] response_url post failed", error);
    return { ok: false, error: "network_error" };
  }
}

/** Best-effort: called on disconnect so a removed connection can't still post as the bot. */
export async function revokeToken(accessToken: string): Promise<SlackResult<{ revoked: boolean }>> {
  let response: Response;
  try {
    response = await fetch(`${API}/auth.revoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch (error) {
    console.error("[slack] revoke failed", error);
    return { ok: false, error: "network_error" };
  }

  const json = await readSlackJson<{ ok: boolean; revoked?: boolean; error?: string }>(
    response,
    "auth.revoke"
  );
  if (!json) return { ok: false, error: "invalid_response" };
  if (!json.ok) return { ok: false, error: json.error ?? "unknown_error" };
  return { ok: true, data: { revoked: Boolean(json.revoked) } };
}

export function explainSlackError(error: string): string {
  switch (error) {
    case "slack_not_configured":
      return "Slack isn't set up on this deployment yet.";
    case "invalid_code":
    case "code_already_used":
      return "That connection attempt expired. Try connecting again.";
    case "network_error":
      return "Could not reach Slack. Try again in a moment.";
    case "invalid_response":
      return "Slack returned something unexpected. Try again in a moment.";
    default:
      return `Slack rejected the request (${error}).`;
  }
}
