import { z } from "zod";
import { router, ownedSiteProcedure, paidSiteProcedure } from "../trpc";
import {
  createMember,
  deleteMember,
  listMembers,
  resyncMember,
  updateMember,
} from "@/lib/site/member-service";

const siteInput = z.object({ siteId: z.string().min(1) });
const memberInput = siteInput.extend({ memberId: z.string().min(1) });

/**
 * The congregation directory.
 *
 * Every write is `paidSiteProcedure`, not `ownedSiteProcedure`: these are
 * POSTs to the tRPC route handler, so `(paid)/layout.tsx` never renders for
 * them and the layout paywall does not cover them. `resync` included — it
 * spends a call against a third party.
 *
 * `data: z.unknown()` matches the events router: the real shape is
 * `memberSchema`, parsed inside the service so the one definition covers this
 * caller and any future one.
 */
export const membersRouter = router({
  list: ownedSiteProcedure
    .input(siteInput)
    .query(async ({ input }) => listMembers(input.siteId)),

  create: paidSiteProcedure
    .input(siteInput.extend({ data: z.unknown() }))
    .mutation(async ({ input }) => createMember(input.siteId, input.data)),

  update: paidSiteProcedure
    .input(memberInput.extend({ data: z.unknown() }))
    .mutation(async ({ input }) => updateMember(input.siteId, input.memberId, input.data)),

  remove: paidSiteProcedure
    .input(memberInput)
    .mutation(async ({ input }) => deleteMember(input.siteId, input.memberId)),

  resync: paidSiteProcedure
    .input(memberInput)
    .mutation(async ({ input }) => resyncMember(input.siteId, input.memberId)),
});
