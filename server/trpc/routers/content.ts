import { z } from "zod";
import { router, ownedSiteProcedure, paidSiteProcedure } from "../trpc";
import {
  createEvent,
  createSermon,
  deleteEvent,
  deleteSermon,
  listEvents,
  listSermons,
  updateEvent,
  updateYoutubeChannel,
} from "@/lib/site/content-service";
import { exportRegistrationsCsv, listRegistrations } from "@/lib/site/registrations";
import { updateSocialLinks } from "@/lib/site/service";
import { socialLinksSchema } from "@/lib/validation/social";

const siteInput = z.object({ siteId: z.string().min(1) });

/**
 * Events, sermons, YouTube, and social links.
 *
 * These are the owned, editor-side reads — deliberately NOT the cached public
 * path. `/sites/<slug>` still reads through `getCachedEvents` /
 * `getPublishedSiteBySlug` directly in a Server Component; putting the public
 * render behind tRPC would add a hop and a serialization pass to the one path
 * that has to be fastest.
 */
export const contentRouter = router({
  listEvents: ownedSiteProcedure
    .input(siteInput)
    .query(async ({ input }) => listEvents(input.siteId)),

  /**
   * Creating an event also turns the feature on and inserts the matching
   * homepage band, in one transaction — a church that adds their first event
   * should not then have to hunt for a toggle to make it appear.
   */
  createEvent: paidSiteProcedure
    .input(siteInput.extend({ data: z.unknown() }))
    .mutation(async ({ input }) => createEvent(input.siteId, input.data)),

  updateEvent: paidSiteProcedure
    .input(siteInput.extend({ eventId: z.string().min(1), data: z.unknown() }))
    .mutation(async ({ input }) => updateEvent(input.siteId, input.eventId, input.data)),

  deleteEvent: paidSiteProcedure
    .input(siteInput.extend({ eventId: z.string().min(1) }))
    .mutation(async ({ input }) => deleteEvent(input.siteId, input.eventId)),

  listRegistrations: ownedSiteProcedure
    .input(siteInput.extend({ eventId: z.string().min(1) }))
    .query(async ({ input }) => listRegistrations(input.siteId, input.eventId)),

  exportRegistrations: ownedSiteProcedure
    .input(siteInput.extend({ eventId: z.string().min(1) }))
    .query(async ({ input }) => exportRegistrationsCsv(input.siteId, input.eventId)),

  listSermons: ownedSiteProcedure
    .input(siteInput)
    .query(async ({ input }) => listSermons(input.siteId)),

  createSermon: paidSiteProcedure
    .input(siteInput.extend({ data: z.unknown() }))
    .mutation(async ({ input }) => createSermon(input.siteId, input.data)),

  deleteSermon: paidSiteProcedure
    .input(siteInput.extend({ sermonId: z.string().min(1) }))
    .mutation(async ({ input }) => deleteSermon(input.siteId, input.sermonId)),

  updateYoutube: paidSiteProcedure
    .input(siteInput.extend({ data: z.unknown() }))
    .mutation(async ({ input }) => updateYoutubeChannel(input.siteId, input.data)),

  updateSocial: paidSiteProcedure
    .input(siteInput.extend({ data: socialLinksSchema }))
    .mutation(async ({ input }) => updateSocialLinks(input.siteId, input.data)),
});
