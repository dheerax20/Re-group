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

/**
 * `revalidatePath` throws when there is no request scope to attach the
 * revalidation to — which is exactly the case inside a Trigger.dev task, since
 * that runs in its own process rather than in a Next.js request. The Redis
 * invalidation below is the part that actually matters there (it is what the
 * public read path consults), and the ISR entries age out on their own
 * `revalidate = 300`. So a failure here is logged and stepped over rather than
 * being allowed to fail a build that has already succeeded.
 */
function safeRevalidate(path: string, type?: "page" | "layout") {
  try {
    if (type) revalidatePath(path, type);
    else revalidatePath(path);
  } catch {
    // Outside a request scope (Trigger.dev task, script). Redis still cleared.
  }
}

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
      safeRevalidate(path);
    }
    // Detail pages are dynamic segments; revalidating the layout covers them.
    safeRevalidate(`/sites/${resolvedSlug}/sermons/[slug]`, "page");
    safeRevalidate(`/sites/${resolvedSlug}/events/[slug]`, "page");
    await invalidateSiteCache(resolvedSlug);
  }

  if (!publicOnly) {
    for (const path of APP_PATHS) {
      safeRevalidate(path);
    }
  }
}
