import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, type AppUser } from "@/lib/auth/session";

/**
 * Per-request tRPC context.
 *
 * Deliberately thin: the Auth0-backed user and the database client, nothing
 * else. Ownership is NOT resolved here — it is checked per procedure by
 * `paidSiteProcedure`, mirroring the rule the server actions followed ("per
 * action, not once at a layout boundary"). Resolving a site in context would
 * quietly re-introduce the layout-shaped gate that Server Functions bypass.
 *
 * `getCurrentUser()` is the non-redirecting reader: it returns null instead of
 * throwing a `redirect()`, which a `fetch()` caller cannot act on. The
 * procedure builders turn that null into a real `TRPCError`.
 */
export type TrpcContext = {
  user: AppUser | null;
  db: typeof prisma;
  headers: Headers;
};

export async function createTrpcContext(opts: {
  req: NextRequest;
}): Promise<TrpcContext> {
  const user = await getCurrentUser();
  return { user, db: prisma, headers: opts.req.headers };
}
