import { NextResponse, type NextRequest } from "next/server";
import { isSlackConfigured } from "@/lib/slack/api";
import {
  findConnectionByTeam,
  removeSlackConnection,
  seversTheConnection,
} from "@/lib/slack/connection";
import { parseEventBody, verifySlackRequest } from "@/lib/slack/verify";

export const runtime = "nodejs";

/**
 * Slack's Events API, subscribed to exactly two events — both of which mean
 * "this connection is over".
 *
 * No session, no cookies: `proxy.ts` returns this path before
 * `auth0.middleware()` so the body arrives byte-for-byte intact, and the
 * signature is the only thing that makes this request trustworthy.
 *
 * The response contract that matters here is that Slack RETRIES anything it
 * does not get a prompt 2xx for. So an event we do not handle is acknowledged
 * rather than rejected — a 4xx on an unrecognised event would earn us the same
 * payload three more times for no reason.
 */
export async function POST(request: NextRequest) {
  /**
   * Gated on CONFIGURED, not on the commands flag.
   *
   * Connecting a workspace only requires Slack to be configured, so in the
   * documented "connect on, commands off" state churches can install the app
   * while these events 404. A church that then removes the app in Slack would
   * keep its `SlackConnection` row forever — the dashboard reporting
   * "connected" over a dead token, and `slackTeamId` being unique means that
   * workspace could never be connected to any Regroup site again. Teardown
   * has to be available wherever setup is. (It is also what lets the Events
   * Request URL be saved at all, since the handshake comes through here.)
   */
  if (!isSlackConfigured()) {
    return new NextResponse(null, { status: 404 });
  }

  const verified = await verifySlackRequest(request);
  if (!verified.ok) {
    // Logged server-side, never echoed: the difference between a bad
    // signature and a stale timestamp is a free oracle for anyone probing.
    console.warn(`[slack] events request rejected (${verified.reason})`);
    return new NextResponse(null, { status: 401 });
  }

  const envelope = parseEventBody(verified.rawBody);
  if (!envelope) return new NextResponse(null, { status: 200 });

  /**
   * The one-time handshake Slack performs when the Request URL is saved. It
   * is verified like everything else — the challenge is echoed only after the
   * signature checks out.
   */
  if (envelope.type === "url_verification") {
    return new NextResponse(envelope.challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  if (seversTheConnection(envelope.eventType, envelope.event)) {
    const connection = await findConnectionByTeam(envelope.teamId);
    if (connection) {
      /**
       * No revoke call. Slack has already invalidated the token by the time
       * either of these events fires, so asking it to revoke again would just
       * be a guaranteed `invalid_auth`.
       */
      await removeSlackConnection(connection);
      console.info(
        `[slack] removed the connection for team ${envelope.teamId} after ${envelope.eventType}`
      );
    }
  }

  return new NextResponse(null, { status: 200 });
}
