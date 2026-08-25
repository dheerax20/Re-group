import type { SlackConnection } from "@prisma/client";
import { prisma } from "@/lib/db";
import { revokeToken } from "./api";
import { decryptToken } from "./crypto";

/**
 * Removing a connection, from either end.
 *
 * Three things can sever the link — the church clicks Disconnect, an admin
 * removes the app from Slack (`app_uninstalled`), or Slack revokes the token
 * (`tokens_revoked`) — and all three mean exactly the same thing, so they run
 * the same code. Keeping this OUT of `actions.ts` is deliberate: that file
 * carries `"use server"`, which turns every export into a server action with
 * its own callable endpoint. The events Route Handler needs this function, not
 * a new public POST surface.
 *
 * Deleting rather than flagging revoked is also deliberate: `slackTeamId` is
 * unique, so a kept-but-dead row would permanently block that workspace from
 * ever reconnecting. The audit trail lives on `SiteGenerationJob`, which
 * records `source` and `slackUserId` per edit and survives this.
 */
export async function removeSlackConnection(
  connection: Pick<SlackConnection, "id" | "slackTeamId" | "botAccessToken">,
  options: { revoke?: boolean } = {}
): Promise<void> {
  if (options.revoke) {
    /**
     * Best effort. The local row goes either way: a token this app can no
     * longer use is indistinguishable from disconnected to the church, and a
     * stray row is precisely what would block reconnecting.
     */
    try {
      const revoked = await revokeToken(decryptToken(connection.botAccessToken));
      if (!revoked.ok) {
        console.warn(
          `[slack] revoke failed for team ${connection.slackTeamId} (${revoked.error}); removing the local connection anyway.`
        );
      }
    } catch (error) {
      // A token that cannot even be decrypted (rotated encryption key) must
      // still be removable, or the church is stuck with a connection they
      // cannot disconnect.
      console.warn(
        `[slack] could not decrypt the token for team ${connection.slackTeamId}; removing the local connection anyway.`,
        error
      );
    }
  }

  // `deleteMany` rather than `delete`: Slack retries events, and the second
  // delivery of `app_uninstalled` must be a no-op, not a P2025 that makes
  // Slack retry forever.
  await prisma.slackConnection.deleteMany({ where: { id: connection.id } });
}

/**
 * The connection for a Slack workspace, or null.
 *
 * Note this looks up by TEAM, not by site: an inbound Slack request knows
 * which workspace it came from and nothing else. What that row is allowed to
 * do is decided afterwards, in `./authorize.ts`.
 */
export async function findConnectionByTeam(
  slackTeamId: string
): Promise<SlackConnection | null> {
  return prisma.slackConnection.findUnique({ where: { slackTeamId } });
}

/**
 * Whether an inbound event means our bot token is gone.
 *
 * `app_uninstalled` always does. `tokens_revoked` does NOT necessarily: Slack
 * also fires it when an individual member's USER token is revoked, and this
 * app requests no user scopes, so it holds none. Tearing down a working
 * connection because someone unrelated tidied up their own authorizations
 * would look, to the church, like Slack randomly disconnecting itself — so
 * the event has to actually name a revoked bot token.
 */
export function seversTheConnection(
  eventType: string,
  event: Record<string, unknown>
): boolean {
  if (eventType === "app_uninstalled") return true;
  if (eventType !== "tokens_revoked") return false;

  const tokens = event.tokens;
  if (typeof tokens !== "object" || tokens === null) return false;

  const bot = (tokens as Record<string, unknown>).bot;
  return Array.isArray(bot) && bot.length > 0;
}
