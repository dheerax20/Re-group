import type { SlackConnection } from "@prisma/client";
import { hasBasePlan, hasFeature } from "@/lib/billing/entitlements";
import { ADDONS } from "@/lib/billing/plan";
import { findConnectionByTeam } from "./connection";

/**
 * Whether this person, in this channel, may edit this church's website.
 *
 * A verified signature proves a request came from Slack. It proves nothing
 * about permission — the team, user and channel ids in the body are just
 * lookup keys, and everything that decides is read from our own row.
 *
 * Never redirects. A 302 is meaningless to Slack, which would render it as a
 * failed command; this returns a discriminated result the caller turns into
 * an ephemeral message, the same shape `authorizeSiteRequest` uses for Route
 * Handlers.
 *
 * Two rules about what the copy may say, both load-bearing:
 *
 * - A wrong-channel refusal names the bound channel ONLY to the bound owner.
 *   To anyone else it says nothing about how the church has things set up.
 * - A wrong-person refusal never names the bound account. "Ask Sarah" leaks a
 *   colleague's identity into a channel to answer a question nobody asked.
 */

export type SlackActorFailureCode =
  | "NO_CONNECTION"
  | "NOT_BOUND"
  | "WRONG_CHANNEL"
  | "NOT_OWNER"
  | "NO_PLAN"
  | "NO_ADDON";

export type SlackActorAuthorization =
  | { ok: true; siteId: string; userId: string; connection: SlackConnection }
  | { ok: false; code: SlackActorFailureCode; message: string };

function refuse(code: SlackActorFailureCode, message: string): SlackActorAuthorization {
  return { ok: false, code, message };
}

/** Slack sometimes returns the channel already prefixed, sometimes not. */
function formatChannel(name: string | null): string {
  if (!name) return "the channel you picked when connecting";
  return name.startsWith("#") ? name : `#${name}`;
}

export async function authorizeSlackActor(
  teamId: string,
  slackUserId: string,
  channelId: string
): Promise<SlackActorAuthorization> {
  const connection = await findConnectionByTeam(teamId);
  if (!connection) {
    return refuse(
      "NO_CONNECTION",
      "This Slack workspace isn't connected to a Regroup site. Connect it from your Regroup dashboard first."
    );
  }

  /**
   * A connection from before the channel picker existed. It has a working
   * token and no idea where it may speak or who may speak to it, and no
   * backfill can invent either — so it is refused until the church reconnects.
   */
  if (!connection.channelId || !connection.ownerSlackUserId) {
    return refuse(
      "NOT_BOUND",
      "This workspace was connected before channel selection existed. Reconnect Slack from your Regroup dashboard and pick a channel."
    );
  }

  const isOwner = slackUserId === connection.ownerSlackUserId;

  if (channelId !== connection.channelId) {
    return refuse(
      "WRONG_CHANNEL",
      isOwner
        ? `Regroup only answers in ${formatChannel(connection.channelName)}.`
        : "Regroup isn't set up for this channel."
    );
  }

  if (!isOwner) {
    // Deliberately anonymous. Naming the bound account would publish a
    // colleague's identity to everyone who can read the channel.
    return refuse(
      "NOT_OWNER",
      "Only the Regroup account that connected this workspace can edit the site."
    );
  }

  /**
   * Billing is checked on EVERY command, not once at connect time.
   *
   * `past_due` and `unpaid` revoke entitlements while leaving the subscription
   * alive, so a church that lapses loses Slack access by itself and gets it
   * back the moment they fix billing — with no reconnect, and nothing to
   * remember to switch off by hand.
   */
  const userId = connection.installedByUserId;

  if (!(await hasBasePlan(userId))) {
    return refuse(
      "NO_PLAN",
      "This Regroup site doesn't have an active plan. Check billing in your Regroup dashboard."
    );
  }

  /**
   * The SAME entitlement the website builder itself needs. Slack is a second
   * surface onto that editor, not a second product, so it is not charged for
   * separately — but it is still checked here, per command, so a church whose
   * add-on lapses loses both surfaces together rather than keeping a back door
   * open through Slack.
   */
  if (!(await hasFeature(userId, ADDONS.website.featureKey))) {
    return refuse(
      "NO_ADDON",
      `Editing your website needs the ${ADDONS.website.label} add-on. You can add it under Settings → Billing in Regroup.`
    );
  }

  return { ok: true, siteId: connection.siteId, userId, connection };
}
