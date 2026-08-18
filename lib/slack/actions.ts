"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOwnedPaidSite, requireOwnedSite } from "@/lib/auth/session";
import { isSlackConfigured, revokeToken } from "./api";
import { signOAuthState } from "./state";
import { decryptToken } from "./crypto";

/**
 * The connection half of Slack: authorize URL, status, disconnect. Sending
 * a message from Slack back into a site is a separate, not-yet-built piece —
 * this only gets a workspace and a site introduced to each other.
 */

function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/api/slack/oauth/callback`;
}

/** Scopes this app actually uses. Kept minimal — broader scopes are a bigger ask of a church's Slack admin for no benefit yet. */
const OAUTH_SCOPES = ["commands", "chat:write"].join(",");

export type SlackConnectionState = {
  enabled: boolean;
  connected: boolean;
  teamName?: string;
  connectedAt?: string;
  authorizeUrl?: string;
};

export async function getSlackConnectionState(siteId: string): Promise<SlackConnectionState> {
  await requireOwnedSite(siteId);

  if (!isSlackConfigured()) {
    return { enabled: false, connected: false };
  }

  const connection = await prisma.slackConnection.findUnique({ where: { siteId } });
  if (connection) {
    return {
      enabled: true,
      connected: true,
      teamName: connection.slackTeamName,
      connectedAt: connection.updatedAt.toISOString(),
    };
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const authorizeUrl =
    `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(clientId!)}` +
    `&scope=${encodeURIComponent(OAUTH_SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri())}` +
    `&state=${encodeURIComponent(signOAuthState(siteId))}`;

  return { enabled: true, connected: false, authorizeUrl };
}

export async function disconnectSlack(siteId: string) {
  await requireOwnedPaidSite(siteId);

  const connection = await prisma.slackConnection.findUnique({ where: { siteId } });
  if (!connection) {
    return { success: false as const, error: "No Slack workspace is connected." };
  }

  // Best-effort: the local row is removed either way, because a token this
  // app can no longer use to post is the same as disconnected from the
  // church's point of view, and a stray row is what would block reconnecting
  // (slackTeamId is unique).
  const token = decryptToken(connection.botAccessToken);
  const revoked = await revokeToken(token);
  if (!revoked.ok) {
    console.warn(
      `[slack] revoke failed for team ${connection.slackTeamId} (${revoked.error}); removing the local connection anyway.`
    );
  }

  await prisma.slackConnection.delete({ where: { siteId } });
  revalidatePath("/dashboard/slack");

  return { success: true as const };
}
