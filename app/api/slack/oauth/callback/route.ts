import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { authTest, exchangeOAuthCode, revokeToken, slackRedirectUri } from "@/lib/slack/api";
import { verifyOAuthState } from "@/lib/slack/state";
import { decryptToken, encryptToken } from "@/lib/slack/crypto";
import { hasFeature } from "@/lib/billing/entitlements";
import { ADDONS } from "@/lib/billing/plan";

export const runtime = "nodejs";

/**
 * Where Slack sends the browser back after a church admin approves the
 * install. GET, because this is a full-page redirect Slack issues — never a
 * fetch — so there is no session-bound CSRF token to check the way a form
 * POST would carry one. `state` is what stands in for it (see
 * `lib/slack/state.ts`).
 */

function redirectTo(path: string, request: NextRequest) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // Slack sends this when the admin clicks "Cancel" on the install screen —
  // not an error, just a no-op back to where they started.
  if (searchParams.get("error")) {
    return redirectTo("/dashboard/slack?slack=cancelled", request);
  }

  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  if (!code || !stateParam) {
    return redirectTo("/dashboard/slack?slack=invalid_request", request);
  }

  const state = verifyOAuthState(stateParam);
  if (!state) {
    return redirectTo("/dashboard/slack?slack=expired", request);
  }

  // Defense in depth: `state` already proves this callback corresponds to an
  // authorize request this app issued, but the session is checked again
  // rather than trusting the embedded siteId on its own — the same rule
  // every other mutation in this app follows.
  const user = await getCurrentUser();
  if (!user || !user.site || user.site.id !== state.siteId) {
    return redirectTo("/post-auth", request);
  }

  /**
   * The add-on is re-checked HERE, not only where the Connect button renders.
   * Withholding a link from one screen stops nobody from opening this URL
   * directly, and this is the request that actually grants Slack access.
   */
  if (!(await hasFeature(user.id, ADDONS.website.featureKey))) {
    return redirectTo("/dashboard/slack?slack=no_addon", request);
  }

  // Must be the SAME string the authorize URL carried, or Slack rejects the
  // exchange with `bad_redirect_uri` — hence the shared helper rather than
  // this request's own origin, which differs behind a tunnel or a proxy.
  const exchanged = await exchangeOAuthCode(code, slackRedirectUri());
  if (!exchanged.ok) {
    console.error(`[slack] oauth exchange failed: ${exchanged.error}`);
    return redirectTo("/dashboard/slack?slack=failed", request);
  }

  const { accessToken, botUserId, teamId, teamName, authedUserId, scopes, channel } =
    exchanged.data;

  /**
   * The workspace-ownership check comes FIRST, before anything that could
   * revoke.
   *
   * `auth.revoke` is scoped to the app's install in the workspace, not to
   * this one exchange, so revoking a token for a workspace that already
   * belongs to another site tears down a connection working perfectly well
   * for somebody else — while that site's row still says "connected". Every
   * `discard()` below is safe only because this check has already passed.
   */
  const claimedByAnotherSite = await prisma.slackConnection.findFirst({
    where: { slackTeamId: teamId, siteId: { not: state.siteId } },
  });
  if (claimedByAnotherSite) {
    // Not revoked, deliberately. An unstored token is inert; a broken install
    // belonging to someone else is not.
    return redirectTo("/dashboard/slack?slack=team_taken", request);
  }

  /**
   * A half-bound row is worse than no row.
   *
   * Without a channel there is nowhere `/regroup` may be used, and without an
   * `authed_user.id` there is nobody authorized to use it — so the connection
   * would look healthy in the settings panel while refusing every command.
   * Refusing the install and asking them to try again is the honest outcome.
   */
  if (!channel || !authedUserId) {
    console.error(
      `[slack] install for team ${teamId} returned no ${!channel ? "channel" : "authed user"}`
    );
    await discard(accessToken);
    return redirectTo("/dashboard/slack?slack=no_channel", request);
  }

  /**
   * Encrypt first, then smoke-test the DECRYPTED token.
   *
   * Doing it in that order is what makes this a real check of the storage
   * round trip and not just of Slack: if `SLACK_TOKEN_ENCRYPTION_KEY` is
   * wrong or has been rotated, the failure surfaces here, on a screen that
   * can say so, rather than the first time a church runs a command.
   */
  const botAccessToken = encryptToken(accessToken);
  const identity = await authTest(decryptToken(botAccessToken));
  if (!identity.ok) {
    console.error(`[slack] auth.test rejected a fresh token: ${identity.error}`);
    await discard(accessToken);
    return redirectTo("/dashboard/slack?slack=failed", request);
  }

  const fields = {
    slackTeamId: teamId,
    slackTeamName: teamName,
    botUserId,
    botAccessToken,
    // From the SERVER SESSION, never from a query parameter.
    installedByUserId: user.id,
    channelId: channel.id,
    channelName: channel.name,
    ownerSlackUserId: authedUserId,
    scopes,
  };

  // Upserting on siteId is what makes reconnecting the supported way to change
  // the bound channel or the bound Slack identity — it rebinds in place rather
  // than accumulating rows.
  await prisma.slackConnection.upsert({
    where: { siteId: state.siteId },
    create: { siteId: state.siteId, ...fields },
    update: fields,
  });

  return redirectTo("/dashboard/slack?slack=connected", request);
}

/**
 * Throws away a token from an install we refused.
 *
 * We hold a live bot token at this point and are about to forget it. Leaving
 * it valid would mean Slack believes the app is installed and working while
 * nothing here can ever use that token again. Best effort — the refusal
 * stands either way.
 */
async function discard(accessToken: string): Promise<void> {
  const revoked = await revokeToken(accessToken);
  if (!revoked.ok) {
    console.warn(`[slack] could not revoke a discarded token: ${revoked.error}`);
  }
}
