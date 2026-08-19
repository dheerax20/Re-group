import { cache } from "react";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { createCallerFactory } from "./trpc";
import { appRouter } from "./routers/_app";

/**
 * The API, callable from a Server Component without a network round trip.
 *
 * Server Components could import the service functions directly, but then the
 * ownership and plan checks would be back to something each caller has to
 * remember — the exact failure mode `paidSiteProcedure` exists to prevent.
 * Going through the same procedures means a page and a browser mutation are
 * gated identically, and there is one definition of "may this caller do this".
 *
 * `cache()` dedupes the context for one render pass, matching `getCurrentUser`
 * underneath it.
 */
const createCaller = createCallerFactory(appRouter);

export const api = cache(async function api() {
  const user = await getCurrentUser();
  return createCaller({
    user,
    db: prisma,
    headers: await headers(),
  });
});
