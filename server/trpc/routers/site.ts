import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, authedProcedure, ownedSiteProcedure, paidSiteProcedure } from "../trpc";
import { churchInfoSchema } from "@/lib/validation/church";
import { brandConfigSchema } from "@/lib/validation/brand";
import { navigationConfigSchema } from "@/lib/validation/navigation";
import { sectionConfigSchema } from "@/lib/validation/section";
import { slugSchema } from "@/lib/validation/slug";
import { featureConfigSchema } from "@/lib/features/types";
import {
  checkSlugAvailable,
  createDraftSite,
  getSite,
  publishSite,
  resumeHref,
  suggestSlug,
  unpublishSite,
  updateBrand,
  updateChurchInfo,
  updateFeatures,
  updateNavigation,
  updateSections,
} from "@/lib/site/service";
import { getSiteContent } from "@/lib/site/get-site-content";

const siteInput = z.object({ siteId: z.string().min(1) });

export const siteRouter = router({
  /** The full owned-site payload the builder workspace renders from. */
  get: ownedSiteProcedure.input(siteInput).query(async ({ input }) => {
    const site = await getSite(input.siteId);
    if (!site) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Site not found." });
    }
    const content = await getSiteContent(input.siteId);
    return { site, content };
  }),

  /**
   * Just the render config, without the sermon/event content payload.
   *
   * Separate from `get` because most screens only need the configuration and
   * pulling twenty sermons and twenty events alongside it is waste on every
   * one of them.
   */
  config: ownedSiteProcedure.input(siteInput).query(async ({ input }) => {
    const site = await getSite(input.siteId);
    if (!site) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Site not found." });
    }
    return site;
  }),

  /**
   * The caller's own site, or null.
   *
   * User-scoped rather than site-scoped: it is what a screen calls when it
   * does not yet know a siteId. One website per Auth0 account, so there is
   * never more than one to choose between.
   */
  mine: authedProcedure.query(async ({ ctx }) => ctx.user.site),

  /** Where a returning user should land — resolves real state, not "has a row". */
  resumeHref: ownedSiteProcedure
    .input(siteInput)
    .query(async ({ input }) => resumeHref(input.siteId)),

  createDraft: authedProcedure.mutation(async ({ ctx }) =>
    createDraftSite(ctx.user.id, ctx.user.site?.id)
  ),

  updateInfo: paidSiteProcedure
    .input(siteInput.extend({ data: churchInfoSchema }))
    .mutation(async ({ input }) => updateChurchInfo(input.siteId, input.data)),

  updateBrand: paidSiteProcedure
    .input(siteInput.extend({ data: brandConfigSchema }))
    .mutation(async ({ input }) => updateBrand(input.siteId, input.data)),

  /**
   * Feature dependencies are still validated inside the service, not just by
   * the schema — "sermon search requires sermons" is a cross-field rule, and
   * keeping it at the write site means every caller gets it.
   */
  updateFeatures: paidSiteProcedure
    .input(siteInput.extend({ data: featureConfigSchema }))
    .mutation(async ({ input }) => updateFeatures(input.siteId, input.data)),

  updateSections: paidSiteProcedure
    .input(siteInput.extend({ data: sectionConfigSchema }))
    .mutation(async ({ input }) => updateSections(input.siteId, input.data)),

  /** Keeps the `allowedHrefs(features)` rejection — nav cannot point at a disabled page. */
  updateNavigation: paidSiteProcedure
    .input(siteInput.extend({ data: navigationConfigSchema }))
    .mutation(async ({ input }) => updateNavigation(input.siteId, input.data)),

  checkSlug: ownedSiteProcedure
    .input(siteInput.extend({ slug: z.string() }))
    .query(async ({ input }) => checkSlugAvailable(input.slug, input.siteId)),

  suggestSlug: authedProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => suggestSlug(input.name)),

  /**
   * Validation runs before any mutation, a rename invalidates BOTH slugs, and
   * the primary domain is re-synced. All three orderings are load-bearing —
   * see `publishSite`.
   */
  publish: paidSiteProcedure
    .input(siteInput.extend({ slug: slugSchema }))
    .mutation(async ({ input }) => publishSite(input.siteId, input.slug)),

  unpublish: paidSiteProcedure
    .input(siteInput)
    .mutation(async ({ input }) => unpublishSite(input.siteId)),
});
