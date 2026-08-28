import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Which paths skip Clerk.
 *
 * Slack and Stripe both sign the RAW request body, so any middleware that
 * buffers, re-encodes or attaches cookies to those requests breaks signature
 * verification for every one of them — silently, and only in production,
 * where the signatures are real. The failure looks like "Slack says our app
 * is broken", not like a middleware regression, so the routing decision gets
 * a test of its own.
 *
 * The case that matters most is the LAST one: `/api/slack/oauth/callback`
 * lives under the same namespace as the webhooks but genuinely needs the
 * session, so the check has to be exact-match. A `startsWith("/api/slack")`
 * would pass every other assertion here and break connecting a workspace.
 */
const clerkSentinel = { __clerk: true };
const middleware = vi.fn(async () => clerkSentinel);
const resolveHostnameInProxy = vi.fn(async () => null);

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: () => () => middleware(),
}));

vi.mock("@/lib/domains/proxy-resolve", () => ({
  resolveHostnameInProxy: () => resolveHostnameInProxy(),
}));

const { proxy } = await import("@/proxy");

function request(pathname: string) {
  return new NextRequest(`https://regroup.app${pathname}`, {
    method: "POST",
    headers: { host: "regroup.app" },
  });
}

beforeEach(() => {
  middleware.mockClear();
});

describe("proxy raw-body webhooks", () => {
  const webhooks = [
    "/api/stripe/webhook",
    "/api/slack/commands",
    "/api/slack/events",
    "/api/slack/interactivity",
  ];

  it.each(webhooks)("%s returns before clerkMiddleware() runs", async (pathname) => {
    const response = await proxy(request(pathname), {} as never);

    expect(middleware).not.toHaveBeenCalled();
    expect(response).not.toBe(clerkSentinel);
  });

  it("the Slack OAuth callback still goes through clerkMiddleware()", async () => {
    const response = await proxy(request("/api/slack/oauth/callback"), {} as never);

    expect(middleware).toHaveBeenCalledTimes(1);
    expect(response).toBe(clerkSentinel);
  });

  it("matches exactly — a path merely starting with a webhook path is not exempt", async () => {
    const response = await proxy(request("/api/slack/commands/extra"), {} as never);

    expect(middleware).toHaveBeenCalledTimes(1);
    expect(response).toBe(clerkSentinel);
  });
});
