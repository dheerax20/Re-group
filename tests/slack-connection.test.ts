import { describe, expect, it, vi } from "vitest";

/**
 * Which Slack events actually end a connection.
 *
 * The interesting case is `tokens_revoked`. Slack fires it whenever ANY token
 * belonging to the app is revoked, including an individual member's user
 * token — and this app requests no user scopes, so it never holds one.
 * Treating every `tokens_revoked` as "we've been uninstalled" would tear down
 * a perfectly good connection because someone unrelated tidied up their own
 * authorizations, which to the church looks like Slack disconnecting itself.
 */
vi.mock("@/lib/db", () => ({ prisma: {} }));

const { seversTheConnection } = await import("@/lib/slack/connection");

describe("seversTheConnection", () => {
  it("treats app_uninstalled as final regardless of payload", () => {
    expect(seversTheConnection("app_uninstalled", {})).toBe(true);
  });

  it("disconnects when a bot token was revoked", () => {
    expect(
      seversTheConnection("tokens_revoked", { tokens: { bot: ["B1"] } })
    ).toBe(true);
  });

  it("ignores a revocation that only names user tokens", () => {
    // We hold no user tokens, so this says nothing about our connection.
    expect(
      seversTheConnection("tokens_revoked", { tokens: { oauth: ["U1"] } })
    ).toBe(false);
  });

  it("ignores an empty bot list", () => {
    expect(
      seversTheConnection("tokens_revoked", { tokens: { bot: [], oauth: ["U1"] } })
    ).toBe(false);
  });

  it("ignores a malformed tokens field rather than throwing", () => {
    expect(seversTheConnection("tokens_revoked", {})).toBe(false);
    expect(seversTheConnection("tokens_revoked", { tokens: null })).toBe(false);
    expect(seversTheConnection("tokens_revoked", { tokens: "bot" })).toBe(false);
  });

  it("ignores events this app does not act on", () => {
    expect(seversTheConnection("message", { tokens: { bot: ["B1"] } })).toBe(false);
    expect(seversTheConnection("app_home_opened", {})).toBe(false);
  });
});
