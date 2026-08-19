import { z } from "zod";
import { router, ownedSiteProcedure, paidSiteProcedure } from "../trpc";
import { prisma } from "@/lib/db";

const siteInput = z.object({ siteId: z.string().min(1) });

/**
 * Media listing and deletion.
 *
 * Uploading itself stays on `app/api/uploads/route.ts`: it is multipart, it
 * inspects the real magic bytes rather than the client-supplied MIME type, and
 * neither of those fits a JSON procedure.
 */
export const mediaRouter = router({
  list: ownedSiteProcedure.input(siteInput).query(async ({ input }) =>
    prisma.media.findMany({
      where: { siteId: input.siteId },
      orderBy: { createdAt: "desc" },
    })
  ),

  /**
   * Scoped by `siteId` as well as `id` so a stolen media id from another
   * church's site matches nothing — ownership is proven by the query, not
   * only by the middleware.
   */
  delete: paidSiteProcedure
    .input(siteInput.extend({ mediaId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const media = await prisma.media.findFirst({
        where: { id: input.mediaId, siteId: input.siteId },
      });
      if (!media) return { success: false as const };

      // Only the row is removed. `StorageProvider` has no delete today, so the
      // bucket object is deliberately left behind rather than pretended away —
      // an orphaned object is invisible and cheap, and inventing a delete that
      // silently does nothing would be worse than saying so here.
      await prisma.media.delete({ where: { id: media.id } });
      return { success: true as const };
    }),
});
