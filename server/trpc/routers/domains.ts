import { z } from "zod";
import { router, ownedSiteProcedure, paidSiteProcedure } from "../trpc";
import {
  addDomain,
  getDomains,
  refreshDomains,
  removeDomain,
  setPrimaryDomain,
  verifyDomain,
} from "@/lib/domains/service";

const siteInput = z.object({ siteId: z.string().min(1) });
/** The registrable domain, which is the unit a church actually looks at. */
const rootInput = siteInput.extend({ root: z.string().min(3) });

/**
 * Custom domains.
 *
 * Every invariant from the action version survives verbatim inside the
 * service: rate limit before anything, hostname validation, the five-per-site
 * cap, apex + `www.` attached as a pair, and Vercel called BEFORE any row is
 * written so the database never claims a hostname the platform cannot serve.
 */
export const domainsRouter = router({
  list: ownedSiteProcedure
    .input(siteInput)
    .query(async ({ input }) => getDomains(input.siteId)),

  add: paidSiteProcedure
    .input(siteInput.extend({ hostname: z.string().min(3).max(253) }))
    .mutation(async ({ ctx, input }) =>
      addDomain(input.siteId, ctx.user.id, input.hostname)
    ),

  refresh: paidSiteProcedure
    .input(siteInput)
    .mutation(async ({ ctx, input }) => refreshDomains(input.siteId, ctx.user.id)),

  verify: paidSiteProcedure
    .input(rootInput)
    .mutation(async ({ ctx, input }) =>
      verifyDomain(input.siteId, ctx.user.id, input.root)
    ),

  setPrimary: paidSiteProcedure
    .input(rootInput)
    .mutation(async ({ input }) => setPrimaryDomain(input.siteId, input.root)),

  remove: paidSiteProcedure
    .input(rootInput)
    .mutation(async ({ input }) => removeDomain(input.siteId, input.root)),
});
