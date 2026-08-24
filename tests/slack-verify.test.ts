import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseCommandBody,
  parseEventBody,
  verifySlackRequest,
} from "@/lib/slack/verify";

/**
 * Slack request verification.
 *
 * This is the whole security boundary for three unauthenticated routes that
 * end in an LLM call and a write to a church's website, so every failure mode
 * is asserted rather than assumed — including the two that are easy to get
 * subtly wrong: a FUTURE timestamp (guarding only against stale ones leaves a
 * forward-dated request replayable until the clock catches up) and a
 * signature of the wrong LENGTH (`timingSafeEqual` throws instead of
 * returning false, so a naive implementation 500s on malformed input rather
 * than rejecting it).
 */
const SECRET = "8f742231b10e8888abcd99yyyzzz85a5";
const BODY = "token=x&team_id=T1&user_id=U1&channel_id=C1&command=%2Fregroup&text=hi";

function sign(body: string, timestamp: number, secret = SECRET): string {
  return (
    "v0=" +
    createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex")
  );
}

function slackRequest(
  options: {
    body?: string;
    timestamp?: number;
    signature?: string;
    omitTimestamp?: boolean;
    omitSignature?: boolean;
  } = {}
): Request {
  const body = options.body ?? BODY;
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  const headers = new Headers({ "content-type": "application/x-www-form-urlencoded" });

  if (!options.omitTimestamp) headers.set("x-slack-request-timestamp", String(timestamp));
  if (!options.omitSignature) {
    headers.set("x-slack-signature", options.signature ?? sign(body, timestamp));
  }

  return new Request("https://regroup.app/api/slack/commands", {
    method: "POST",
    headers,
    body,
  });
}

beforeEach(() => {
  vi.stubEnv("SLACK_SIGNING_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("verifySlackRequest", () => {
  it("accepts a correctly signed request and returns the raw body", async () => {
    const result = await verifySlackRequest(slackRequest());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rawBody).toBe(BODY);
  });

  it("rejects a body altered after signing", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const request = new Request("https://regroup.app/api/slack/commands", {
      method: "POST",
      headers: {
        "x-slack-request-timestamp": String(timestamp),
        // Signed over the original body, sent with a different one.
        "x-slack-signature": sign(BODY, timestamp),
      },
      body: BODY.replace("text=hi", "text=delete+everything"),
    });

    const result = await verifySlackRequest(request);

    expect(result).toEqual({ ok: false, reason: "signature_mismatch" });
  });

  it("rejects a signature produced with the wrong secret", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const result = await verifySlackRequest(
      slackRequest({ timestamp, signature: sign(BODY, timestamp, "not-our-secret") })
    );

    expect(result).toEqual({ ok: false, reason: "signature_mismatch" });
  });

  it("rejects a signature of the wrong length without throwing", async () => {
    // `timingSafeEqual` throws on mismatched lengths; the length check has to
    // come first or malformed input becomes a 500 instead of a 401.
    const result = await verifySlackRequest(slackRequest({ signature: "v0=deadbeef" }));

    expect(result).toEqual({ ok: false, reason: "signature_mismatch" });
  });

  it("rejects a stale timestamp even when the signature is valid for it", async () => {
    const timestamp = Math.floor(Date.now() / 1000) - 400;
    const result = await verifySlackRequest(slackRequest({ timestamp }));

    expect(result).toEqual({ ok: false, reason: "timestamp_outside_window" });
  });

  it("rejects a future timestamp", async () => {
    const timestamp = Math.floor(Date.now() / 1000) + 400;
    const result = await verifySlackRequest(slackRequest({ timestamp }));

    expect(result).toEqual({ ok: false, reason: "timestamp_outside_window" });
  });

  it("accepts a timestamp at the edge of the window", async () => {
    const timestamp = Math.floor(Date.now() / 1000) - 299;
    const result = await verifySlackRequest(slackRequest({ timestamp }));

    expect(result.ok).toBe(true);
  });

  it("rejects a non-numeric timestamp", async () => {
    const result = await verifySlackRequest(slackRequest({ signature: sign(BODY, 0) }));
    expect(result.ok).toBe(false);

    const malformed = new Request("https://regroup.app/api/slack/commands", {
      method: "POST",
      headers: {
        "x-slack-request-timestamp": "not-a-number",
        "x-slack-signature": sign(BODY, 0),
      },
      body: BODY,
    });
    expect(await verifySlackRequest(malformed)).toEqual({
      ok: false,
      reason: "malformed_timestamp",
    });
  });

  it("rejects a request missing the timestamp header", async () => {
    const result = await verifySlackRequest(slackRequest({ omitTimestamp: true }));

    expect(result).toEqual({ ok: false, reason: "missing_signature_headers" });
  });

  it("rejects a request missing the signature header", async () => {
    const result = await verifySlackRequest(slackRequest({ omitSignature: true }));

    expect(result).toEqual({ ok: false, reason: "missing_signature_headers" });
  });

  it("refuses everything when the signing secret is not configured", async () => {
    // A deployment with no secret cannot tell a real request from a forged
    // one, so it must refuse rather than fall open.
    vi.stubEnv("SLACK_SIGNING_SECRET", "");

    const result = await verifySlackRequest(slackRequest());

    expect(result).toEqual({ ok: false, reason: "signing_secret_not_configured" });
  });
});

describe("parseCommandBody", () => {
  const valid =
    "team_id=T1&user_id=U1&channel_id=C1&channel_name=website&command=%2Fregroup" +
    "&text=make+the+hero+warmer&response_url=https%3A%2F%2Fhooks.slack.com%2Fcommands%2FT1%2F1%2Fabc" +
    "&trigger_id=123.456.abc";

  it("reads the fields authorization depends on", () => {
    expect(parseCommandBody(valid)).toEqual({
      teamId: "T1",
      userId: "U1",
      channelId: "C1",
      channelName: "website",
      command: "/regroup",
      text: "make the hero warmer",
      responseUrl: "https://hooks.slack.com/commands/T1/1/abc",
      triggerId: "123.456.abc",
    });
  });

  it("defaults an omitted text to empty rather than failing", () => {
    // `/regroup` with no arguments is the help case, not a malformed request.
    const parsed = parseCommandBody(valid.replace("&text=make+the+hero+warmer", ""));

    expect(parsed?.text).toBe("");
  });

  it.each(["team_id=T1", "user_id=U1", "channel_id=C1", "response_url"])(
    "returns null when %s is missing",
    (field) => {
      const key = field.split("=")[0];
      const stripped = valid
        .split("&")
        .filter((pair) => !pair.startsWith(`${key}=`))
        .join("&");

      expect(parseCommandBody(stripped)).toBeNull();
    }
  );

  it("refuses a response_url pointed anywhere but Slack", () => {
    // Defence in depth against SSRF: this URL is one the app POSTs to.
    const hostile = valid.replace(
      "https%3A%2F%2Fhooks.slack.com%2Fcommands%2FT1%2F1%2Fabc",
      "https%3A%2F%2F169.254.169.254%2Flatest%2Fmeta-data"
    );

    expect(parseCommandBody(hostile)).toBeNull();
  });

  it("refuses a plain-http Slack response_url", () => {
    const insecure = valid.replace("https%3A%2F%2Fhooks.slack.com", "http%3A%2F%2Fhooks.slack.com");

    expect(parseCommandBody(insecure)).toBeNull();
  });
});

describe("parseEventBody", () => {
  it("reads the url_verification handshake", () => {
    expect(parseEventBody(JSON.stringify({ type: "url_verification", challenge: "abc" }))).toEqual({
      type: "url_verification",
      challenge: "abc",
    });
  });

  it("reads an event_callback's team and event type", () => {
    const body = JSON.stringify({
      type: "event_callback",
      team_id: "T1",
      event: { type: "app_uninstalled" },
    });

    expect(parseEventBody(body)).toEqual({
      type: "event_callback",
      teamId: "T1",
      eventType: "app_uninstalled",
      event: { type: "app_uninstalled" },
    });
  });

  it("hands the inner event through so the route can inspect it", () => {
    // `tokens_revoked` fires for USER tokens too, which this app never holds.
    // The route has to see `tokens.bot` to tell the two apart.
    const body = JSON.stringify({
      type: "event_callback",
      team_id: "T1",
      event: { type: "tokens_revoked", tokens: { oauth: ["U1"], bot: ["B1"] } },
    });

    const parsed = parseEventBody(body);

    expect(parsed).toMatchObject({
      eventType: "tokens_revoked",
      event: { tokens: { bot: ["B1"] } },
    });
  });

  it("returns null for an event_callback with no team", () => {
    const body = JSON.stringify({ type: "event_callback", event: { type: "app_uninstalled" } });

    expect(parseEventBody(body)).toBeNull();
  });

  it("returns null for unparseable or unrecognised bodies", () => {
    expect(parseEventBody("not json")).toBeNull();
    expect(parseEventBody("null")).toBeNull();
    expect(parseEventBody(JSON.stringify({ type: "something_new" }))).toBeNull();
  });
});
