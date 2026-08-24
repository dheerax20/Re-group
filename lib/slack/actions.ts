"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOwnedPaidSite, requireOwnedSite } from "@/lib/auth/session";
import { hasFeature } from "@/lib/billing/entitlements";
import { ADDONS } from "@/lib/billing/plan";
import { getAiBudget } from "@/lib/ai/usage";
import { getCatalog, toDisplayPrice } from "@/lib/billing/catalog";
import { isSlackCommandsEnabled, isSlackConfigured, slackRedirectUri } from "./api";
import { removeSlackConnection } from "./connection";
import { signOAuthState } from "./state";

/**
 * The connection half of Slack: authorize URL, status, disconnect. What a
 * connected workspace may then DO lives in `./authorize.ts` and the routes
 * under `app/api/slack/`.
 */

/**
 * Scopes this app requests. Four, and each earns its place:
 *
 * - `commands` — the slash command itself.
 * - `chat:write` — posting and updating the app's own messages.
 * - `chat:write.public` — posting to a PUBLIC channel the bot was never
 *   invited to. Slack's docs are explicit that bot users cannot join channels
 *   on their own and must be invited, so without this the install would seat a
 *   bot that cannot speak in the very channel the installer just picked.
 * - `incoming-webhook` — requested purely for its side effect: it makes Slack
 *   render a channel picker inside the existing consent screen. That is where
 *   `channelId` comes from. The webhook URL it also returns is discarded.
 *
 * Deliberately absent: `channels:read` (the picker already tells us the
 * channel), `channels:history` (the bot never reads ambient traffic),
 * `users:read.email` (a Slack profile email is not proof of control of a
 * Regroup account), and any DM scope.
 */
const OAUTH_SCOPES = [
  "commands",
  "chat:write",
  "chat:write.public",
  "incoming-webhook",
].join(",");

export type SlackConnectionState = {
  /** Whether this deployment has Slack configured at all. */
  enabled: boolean;
  connected: boolean;
  /** Whether the plan includes the Website Builder add-on, which Slack rides on. */
  hasAddon: boolean;
  teamName?: string;
  /** The bound channel, e.g. "#website". Null on a pre-alpha connection. */
  channelName?: string | null;
  /**
   * A connection made before the channel picker existed: it has a working
   * token but no bound channel or identity, so no command can be authorized
   * until the church reconnects.
   */
  needsRebind?: boolean;
  connectedAt?: string;
  authorizeUrl?: string;
  /**
   * Whether `/regroup` is actually being served on this deployment. A
   * connected workspace whose commands are switched off is a real state
   * during rollout, and the panel says so rather than promising a command
   * that answers with a 404.
   */
  commandsEnabled: boolean;
  /**
   * The Website Builder add-on's price, so the upsell states a number.
   * Slack rides on that entitlement rather than being sold separately.
   */
  addonPrice?: { amount: number; currency: string; interval: string };
  /** This month's AI edit allowance, shared with the web editor. */
  edits?: { remaining: number; limit: number };
};

/**
 * Best effort. The price comes from Stripe, and a church should still be able
 * to see and manage a connection when Stripe is unreachable or the catalog
 * has not been bootstrapped — `getCatalog` throws in exactly that case.
 */
async function addonPrice(): Promise<SlackConnectionState["addonPrice"]> {
  try {
    const price = (await getCatalog()).get(ADDONS.website.lookupKey);
    if (!price) return undefined;
    const display = toDisplayPrice(price);
    return {
      amount: display.unitAmount,
      currency: display.currency,
      interval: display.interval,
    };
  } catch (error) {
    console.error("[slack] could not read the add-on price", error);
    return undefined;
  }
}

export async function getSlackConnectionState(siteId: string): Promise<SlackConnectionState> {
  const user = await requireOwnedSite(siteId);

  if (!isSlackConfigured()) {
    return { enabled: false, connected: false, hasAddon: false, commandsEnabled: false };
  }

  const commandsEnabled = isSlackCommandsEnabled();
  const hasAddon = await hasFeature(user.id, ADDONS.website.featureKey);

  /**
   * Offered to CONNECTED sites too, not only new ones.
   *
   * Reconnecting is the supported way to change the bound channel or the
   * bound Slack account — Slack's own consent screen is what renders the
   * channel picker — so the panel needs this link precisely when a workspace
   * is already connected. Withholding it there left the panel telling
   * churches to reconnect with no way to do it.
   */
  const authorizeUrl = hasAddon ? buildAuthorizeUrl(siteId) : undefined;

  const connection = await prisma.slackConnection.findUnique({ where: { siteId } });
  if (connection) {
    const edits = await getAiBudget(siteId, "editor_prompt");
    return {
      enabled: true,
      connected: true,
      hasAddon,
      commandsEnabled,
      teamName: connection.slackTeamName,
      channelName: connection.channelName,
      needsRebind: !connection.channelId || !connection.ownerSlackUserId,
      connectedAt: connection.updatedAt.toISOString(),
      edits: { remaining: edits.remaining, limit: edits.limit },
      authorizeUrl,
    };
  }

  /**
   * No add-on, no authorize URL. This is the convenience half of the gate —
   * the binding half is re-checked server-side in the OAuth callback, because
   * withholding a link from one screen stops nobody from opening the callback
   * directly.
   */
  if (!hasAddon) {
    return {
      enabled: true,
      connected: false,
      hasAddon: false,
      commandsEnabled,
      addonPrice: await addonPrice(),
    };
  }

  return { enabled: true, connected: false, hasAddon: true, commandsEnabled, authorizeUrl };
}

function buildAuthorizeUrl(siteId: string): string {
  const clientId = process.env.SLACK_CLIENT_ID;
  return (
    `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(clientId!)}` +
    `&scope=${encodeURIComponent(OAUTH_SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(slackRedirectUri())}` +
    // Short-lived and HMAC'd: this is both the CSRF protection Slack's flow
    // expects and how the callback knows which site the install is for.
    `&state=${encodeURIComponent(signOAuthState(siteId))}`
  );
}

export async function disconnectSlack(siteId: string) {
  await requireOwnedPaidSite(siteId);

  const connection = await prisma.slackConnection.findUnique({ where: { siteId } });
  if (!connection) {
    return { success: false as const, error: "No Slack workspace is connected." };
  }

  // Revoking is worth doing from this end — the church still has a live token
  // and asked us to stop being able to post. The uninstall path skips it,
  // because Slack has already invalidated the token by then.
  await removeSlackConnection(connection, { revoke: true });
  revalidatePath("/dashboard/slack");

  return { success: true as const };
}
