import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createCallerFactory,
  router,
  ownedSiteProcedure,
  authedProcedure,
} from "@/server/trpc/trpc";

/**
 * The procedure guards.
 *
 * These exist because of a real bug: `ownedSiteProcedure` is attached to the
 * BUILDER, so it runs before the `.input()` parser each concrete procedure
 * registers afterwards. Reading the middleware's `input` argument therefore
 * always saw `undefined`, and every site-scoped call — including the dashboard
 * — died with "This request must name a site." The fix is `getRawInput()`.
 *
 * The distinction the tests below turn on is the one that caught it: a
 * mismatched site must be FORBIDDEN, because that proves the guard actually
 * READ the id. BAD_REQUEST means it saw nothing at all.
 *
 * A stand-in router is used rather than the real one because `appRouter` pulls
 * in `next/font` through the brand schema, which cannot execute outside a
 * Next.js build. The builder and its middleware chain are the real ones, which
 * is the part under test.
 */
const probe = router({
  read: ownedSiteProcedure
    .input(z.object({ siteId: z.string().min(1) }))
    .query(({ ctx, input }) => ({ siteId: input.siteId, ctxSiteId: ctx.siteId })),

  noSite: authedProcedure.query(({ ctx }) => ctx.user.id),
});

const createCaller = createCallerFactory(probe);

type TestUser = {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  picture: string | null;
  site: { id: string; name: string; slug: string; status: "DRAFT" } | null;
};

const user: TestUser = {
  id: "u1",
  clerkId: "user_1",
  email: "pastor@grace.org",
  name: "Pastor",
  picture: null,
  site: { id: "site-owned", name: "Grace", slug: "grace", status: "DRAFT" as const },
};

function caller(as: TestUser | null = user) {
  return createCaller({
    user: as,
    db: {} as never,
    headers: new Headers(),
  } as never);
}

/** tRPC wraps thrown errors; this reads the code off whatever comes back. */
async function codeOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "OK";
  } catch (error) {
    return (error as { code?: string }).code ?? "UNKNOWN";
  }
}

describe("ownedSiteProcedure", () => {
  it("lets the owner through and exposes the site on ctx", async () => {
    const result = await caller().read({ siteId: "site-owned" });
    expect(result).toEqual({ siteId: "site-owned", ctxSiteId: "site-owned" });
  });

  it("reads siteId from the raw input, so a mismatch is FORBIDDEN not BAD_REQUEST", async () => {
    // The regression guard. Before the getRawInput() fix this was BAD_REQUEST,
    // because the middleware could not see the input at all.
    expect(await codeOf(() => caller().read({ siteId: "someone-elses-site" }))).toBe(
      "FORBIDDEN"
    );
  });

  it("rejects a caller with no site of their own", async () => {
    const noSite = { ...user, site: null };
    expect(await codeOf(() => caller(noSite).read({ siteId: "site-owned" }))).toBe(
      "FORBIDDEN"
    );
  });

  it("rejects input that names no site", async () => {
    const untyped = caller() as unknown as { read: (input: unknown) => Promise<unknown> };
    expect(await codeOf(() => untyped.read({}))).toBe("BAD_REQUEST");
  });

  it("rejects an anonymous caller before looking at the site", async () => {
    expect(await codeOf(() => caller(null).read({ siteId: "site-owned" }))).toBe(
      "UNAUTHORIZED"
    );
  });
});

describe("authedProcedure", () => {
  it("allows a signed-in caller with no siteId in the input", async () => {
    await expect(caller().noSite()).resolves.toBe("u1");
  });

  it("rejects an anonymous caller", async () => {
    expect(await codeOf(() => caller(null).noSite())).toBe("UNAUTHORIZED");
  });
});
