import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signOAuthState, verifyOAuthState } from "@/lib/slack/state";

/**
 * `state` is the only thing standing between the Slack OAuth callback and a
 * CSRF attack that connects an attacker's Slack workspace to a church's
 * site. Every case here is a way that protection could quietly fail.
 */

const ORIGINAL_SECRET = process.env.SLACK_CLIENT_SECRET;

beforeEach(() => {
  process.env.SLACK_CLIENT_SECRET = "test-client-secret";
});

afterEach(() => {
  vi.useRealTimers();
  if (ORIGINAL_SECRET === undefined) delete process.env.SLACK_CLIENT_SECRET;
  else process.env.SLACK_CLIENT_SECRET = ORIGINAL_SECRET;
});

describe("signOAuthState / verifyOAuthState", () => {
  it("round-trips the siteId it was signed for", () => {
    const state = signOAuthState("site_123");
    expect(verifyOAuthState(state)).toEqual({ siteId: "site_123" });
  });

  it("rejects a state signed under a different secret", () => {
    const state = signOAuthState("site_123");
    process.env.SLACK_CLIENT_SECRET = "a-different-secret";
    expect(verifyOAuthState(state)).toBeNull();
  });

  it("rejects a state with the siteId swapped after signing", () => {
    const state = signOAuthState("site_123");
    const [, signature] = state.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ siteId: "someone_elses_site", exp: Date.now() + 60_000 }),
      "utf8"
    ).toString("base64url");
    expect(verifyOAuthState(`${forgedPayload}.${signature}`)).toBeNull();
  });

  it("rejects garbage input without throwing", () => {
    expect(verifyOAuthState("not-a-real-state")).toBeNull();
    expect(verifyOAuthState("")).toBeNull();
    expect(verifyOAuthState("only-one-part")).toBeNull();
  });

  it("expires after its TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const state = signOAuthState("site_123");

    vi.setSystemTime(new Date("2026-01-01T00:09:00Z"));
    expect(verifyOAuthState(state)).toEqual({ siteId: "site_123" });

    vi.setSystemTime(new Date("2026-01-01T00:11:00Z"));
    expect(verifyOAuthState(state)).toBeNull();
  });
});
