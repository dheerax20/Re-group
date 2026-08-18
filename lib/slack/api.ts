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
      process.env.SLACK_SIGNING_SECRET
  );
}

export type SlackResult<T> = { ok: true; data: T } | { ok: false; error: string };

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

  const json = (await response.json()) as { ok: boolean; error?: string } & Record<
    string,
    unknown
  >;

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
    team: { id: string; name: string };
  }>("oauth.v2.access", {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  if (!result.ok) return result;

  return {
    ok: true,
    data: {
      accessToken: result.data.access_token,
      botUserId: result.data.bot_user_id,
      teamId: result.data.team.id,
      teamName: result.data.team.name,
    },
  };
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

  const json = (await response.json()) as { ok: boolean; revoked?: boolean; error?: string };
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
    default:
      return `Slack rejected the request (${error}).`;
  }
}
