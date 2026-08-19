import { router } from "../trpc";
import { siteRouter } from "./site";
import { contentRouter } from "./content";
import { aiRouter } from "./ai";
import { domainsRouter } from "./domains";
import { mediaRouter } from "./media";

/**
 * The whole API. One surface, one type.
 *
 * What is deliberately NOT here: the upload route (multipart plus magic-byte
 * sniffing does not belong in a JSON-RPC procedure), the Stripe webhook
 * (verified by signature over the raw body), and the internal hostname
 * resolver (called by `proxy.ts`, which cannot reach Prisma at all). Those
 * stay Route Handlers.
 */
export const appRouter = router({
  site: siteRouter,
  content: contentRouter,
  ai: aiRouter,
  domains: domainsRouter,
  media: mediaRouter,
});

export type AppRouter = typeof appRouter;
