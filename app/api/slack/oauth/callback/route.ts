import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { exchangeOAuthCode } from "@/lib/slack/api";
import { verifyOAuthState } from "@/lib/slack/state";
import { encryptToken } from "@/lib/slack/crypto";

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

  const redirectUri = `${request.nextUrl.origin}/api/slack/oauth/callback`;
  const exchanged = await exchangeOAuthCode(code, redirectUri);
  if (!exchanged.ok) {
    console.error(`[slack] oauth exchange failed: ${exchanged.error}`);
    return redirectTo("/dashboard/slack?slack=failed", request);
  }

  const { accessToken, botUserId, teamId, teamName } = exchanged.data;

  const claimedByAnotherSite = await prisma.slackConnection.findFirst({
    where: { slackTeamId: teamId, siteId: { not: state.siteId } },
  });
  if (claimedByAnotherSite) {
    return redirectTo("/dashboard/slack?slack=team_taken", request);
  }

  await prisma.slackConnection.upsert({
    where: { siteId: state.siteId },
    create: {
      siteId: state.siteId,
      slackTeamId: teamId,
      slackTeamName: teamName,
      botUserId,
      botAccessToken: encryptToken(accessToken),
      installedByUserId: user.id,
    },
    update: {
      slackTeamId: teamId,
      slackTeamName: teamName,
      botUserId,
      botAccessToken: encryptToken(accessToken),
      installedByUserId: user.id,
    },
  });

  return redirectTo("/dashboard/slack?slack=connected", request);
}
