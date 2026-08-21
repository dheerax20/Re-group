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
import { updatePageBlocks, UneditablePageError } from "@/lib/site/blocks/manual-edit";

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

  /**
   * Direct block edits from the editor's outline panel — reordering bands and
   * setting a block's font size.
   *
   * Deliberately NOT part of the AI router: these cost no chat budget and make
   * no provider call. They still land on the same validated write path, and
   * `updatePageBlocks` rejects a path the church may not edit rather than
   * trusting the client's `path`.
   */
  updateBlocks: paidSiteProcedure
    .input(
      siteInput.extend({
        path: z.string().min(1).max(120),
        order: z.array(z.string().min(1).max(60)).max(60).optional(),
        /**
         * Only font size. Accepting the full `blockPatchSchema` here would put
         * `remove`, `href` and `src` on a route with no UI behind it, and an
         * image set this way would skip the `Media` bookkeeping the AI path
         * does.
         */
        scales: z
          .array(
            z.object({
              id: z.string().min(1).max(60),
              scale: z.enum(["display", "h1", "h2", "h3", "body", "small"]),
            })
          )
          .max(24)
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await updatePageBlocks(input.siteId, {
          path: input.path,
          order: input.order,
          scales: input.scales,
        });
      } catch (error) {
        /**
         * Only the one error this route defines is a client error. Wrapping
         * everything meant a dropped database connection arrived as a
         * BAD_REQUEST that nothing retries, and put raw Prisma text — host,
         * query fragments — straight into the editor's error line. Anything
         * else goes to `errorTranslation` in ../trpc.ts untouched.
         */
        if (error instanceof UneditablePageError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message, cause: error });
        }
        throw error;
      }
    }),

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
