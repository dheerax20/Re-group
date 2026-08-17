import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { invalidateSiteCache } from "@/lib/cache/redis";
import { SITE_PAGE_LINKS } from "./pages";

/**
 * The one place a site's caches are cleared.
 *
 * There used to be two: `actions.ts` revalidated seven paths and
 * `content-actions.ts` revalidated an overlapping thirteen, so adding a public
 * page meant remembering both and a miss showed up as a church editing their
 * site and seeing no change. The public path list is derived from
 * `SITE_PAGE_LINKS`, which already defines what pages exist, so a new page is
 * covered the moment it is added there.
 */

/** Public paths under `/sites/<slug>` that can show site-level content. */
function publicPaths(slug: string): string[] {
  const pages = SITE_PAGE_LINKS.map((page) =>
    page.href === "/" ? "" : page.href
  );
  return pages.map((path) => `/sites/${slug}${path}`);
}

/** Authenticated screens that read the same data. */
const APP_PATHS = [
  "/dashboard",
  "/dashboard/builder",
  "/dashboard/pages",
  "/dashboard/domains",
  "/events",
  "/sermons",
  "/youtube",
];

export type InvalidateOptions = {
  /** Pass when the caller already knows it, to skip a slug lookup. */
  slug?: string;
  /** Skip revalidating the authenticated app shell (public-only changes). */
  publicOnly?: boolean;
};

export async function invalidateSite(
  siteId: string,
  { slug, publicOnly = false }: InvalidateOptions = {}
): Promise<void> {
  const resolvedSlug =
    slug ??
    (
      await prisma.site.findUnique({
        where: { id: siteId },
        select: { slug: true },
      })
    )?.slug;

  if (resolvedSlug) {
    for (const path of publicPaths(resolvedSlug)) {
      revalidatePath(path);
    }
    // Detail pages are dynamic segments; revalidating the layout covers them.
    revalidatePath(`/sites/${resolvedSlug}/sermons/[slug]`, "page");
    revalidatePath(`/sites/${resolvedSlug}/events/[slug]`, "page");
    await invalidateSiteCache(resolvedSlug);
  }

  if (!publicOnly) {
    for (const path of APP_PATHS) {
      revalidatePath(path);
    }
  }
}
