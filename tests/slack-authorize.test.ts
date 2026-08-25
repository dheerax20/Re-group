import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SlackConnection } from "@prisma/client";

/**
 * Who may edit a church's website from Slack.
 *
 * A verified signature proves a request came from Slack and nothing more, so
 * this is the function that actually decides. Each case below is one way in,
 * and two of them are about what the refusal is allowed to SAY:
 *
 * - Naming the bound channel to a stranger tells them how the church has its
 *   workspace arranged. Only the bound owner gets the channel name.
 * - Naming the bound account ("ask Sarah") publishes a colleague's identity
 *   into a channel to answer a question nobody asked.
 *
 * Copy is asserted directly rather than through a code, because the code is
 * not the part that leaks.
 */
const findUnique = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: { slackConnection: { findUnique: () => findUnique() } },
  withDbRetry: (fn: () => unknown) => fn(),
}));

const hasBasePlan = vi.fn();
const hasFeature = vi.fn();
vi.mock("@/lib/billing/entitlements", () => ({
  hasBasePlan: () => hasBasePlan(),
  hasFeature: () => hasFeature(),
}));

const { authorizeSlackActor } = await import("@/lib/slack/authorize");

const OWNER = "U_OWNER";
const CHANNEL = "C_BOUND";

function connection(overrides: Partial<SlackConnection> = {}): SlackConnection {
  return {
    id: "conn-1",
    siteId: "site-1",
    slackTeamId: "T1",
    slackTeamName: "Grace Chapel",
    botUserId: "B1",
    botAccessToken: "encrypted",
    installedByUserId: "user-1",
    channelId: CHANNEL,
    channelName: "website",
    ownerSlackUserId: OWNER,
    scopes: "commands,chat:write",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as SlackConnection;
}

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue(connection());
  hasBasePlan.mockResolvedValue(true);
  hasFeature.mockResolvedValue(true);
});

describe("authorizeSlackActor", () => {
  it("authorizes the bound owner in the bound channel", async () => {
    const result = await authorizeSlackActor("T1", OWNER, CHANNEL);

    expect(result).toMatchObject({ ok: true, siteId: "site-1", userId: "user-1" });
  });

  it("refuses a workspace with no connection", async () => {
    findUnique.mockResolvedValue(null);

    expect(await authorizeSlackActor("T_UNKNOWN", OWNER, CHANNEL)).toMatchObject({
      ok: false,
      code: "NO_CONNECTION",
    });
  });

  it.each([
    ["no channel", { channelId: null }],
    ["no bound identity", { ownerSlackUserId: null }],
  ])("refuses a pre-alpha connection with %s", async (_label, overrides) => {
    findUnique.mockResolvedValue(connection(overrides));

    const result = await authorizeSlackActor("T1", OWNER, CHANNEL);

    expect(result).toMatchObject({ ok: false, code: "NOT_BOUND" });
    // The church has to be told what to actually do about it.
    if (!result.ok) expect(result.message).toContain("Reconnect Slack");
  });

  it("names the bound channel when the OWNER is in the wrong one", async () => {
    const result = await authorizeSlackActor("T1", OWNER, "C_ELSEWHERE");

    expect(result).toMatchObject({ ok: false, code: "WRONG_CHANNEL" });
    if (!result.ok) expect(result.message).toContain("#website");
  });

  it("does not name the bound channel to anyone else", async () => {
    const result = await authorizeSlackActor("T1", "U_STRANGER", "C_ELSEWHERE");

    expect(result).toMatchObject({ ok: false, code: "WRONG_CHANNEL" });
    if (!result.ok) {
      expect(result.message).not.toContain("website");
      expect(result.message).toContain("isn't set up for this channel");
    }
  });

  it("refuses a workspace member who is not the bound account, without naming it", async () => {
    const result = await authorizeSlackActor("T1", "U_STRANGER", CHANNEL);

    expect(result).toMatchObject({ ok: false, code: "NOT_OWNER" });
    if (!result.ok) {
      expect(result.message).not.toContain(OWNER);
      expect(result.message).not.toContain("user-1");
      expect(result.message).not.toContain("Grace Chapel");
    }
  });

  it("refuses when the base plan has lapsed", async () => {
    hasBasePlan.mockResolvedValue(false);

    expect(await authorizeSlackActor("T1", OWNER, CHANNEL)).toMatchObject({
      ok: false,
      code: "NO_PLAN",
    });
  });

  it("refuses when the Slack add-on is not on the plan", async () => {
    // Checked per command, so removing the add-on takes effect immediately and
    // re-adding it restores access with no reconnect.
    hasFeature.mockResolvedValue(false);

    expect(await authorizeSlackActor("T1", OWNER, CHANNEL)).toMatchObject({
      ok: false,
      code: "NO_ADDON",
    });
  });

  it("checks who and where before it checks billing", async () => {
    // A stranger in the wrong channel should never cause an entitlement
    // lookup — refusing them is free, and this keeps an unauthenticated
    // surface from doing database work on anyone's behalf.
    await authorizeSlackActor("T1", "U_STRANGER", "C_ELSEWHERE");

    expect(hasBasePlan).not.toHaveBeenCalled();
    expect(hasFeature).not.toHaveBeenCalled();
  });

  it("falls back to neutral wording when the bound channel has no stored name", async () => {
    findUnique.mockResolvedValue(connection({ channelName: null }));

    const result = await authorizeSlackActor("T1", OWNER, "C_ELSEWHERE");

    if (!result.ok) expect(result.message).toContain("the channel you picked");
  });
});
