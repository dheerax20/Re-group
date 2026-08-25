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
 * that runs in its own process rather than in a Next.js request.
 *
 * Returns whether it actually worked, because "it didn't" is now actionable:
 * relying on the ISR entries ageing out on their own `revalidate = 300` meant
 * a successful Slack edit showed no change for up to five minutes, which a
 * church reads as a broken edit. `askAppToRevalidate` below covers that case.
 */
function safeRevalidate(path: string, type?: "page" | "layout"): boolean {
  try {
    if (type) revalidatePath(path, type);
    else revalidatePath(path);
    return true;
  } catch {
    // Outside a request scope (Trigger.dev task, script). Redis still cleared.
    return false;
  }
}

/**
 * The revalidation half, callable from inside a request.
 *
 * Split out so `app/api/internal/revalidate` can perform exactly what a
 * task cannot, without duplicating the path list — which is the whole point of
 * this module being the one place caches are cleared.
 */
export function revalidateSitePaths(
  slug: string,
  { publicOnly = false }: { publicOnly?: boolean } = {}
): void {
  for (const path of publicPaths(slug)) {
    safeRevalidate(path);
  }
  // Detail pages are dynamic segments; revalidating the layout covers them.
  safeRevalidate(`/sites/${slug}/sermons/[slug]`, "page");
  safeRevalidate(`/sites/${slug}/events/[slug]`, "page");

  if (!publicOnly) {
    for (const path of APP_PATHS) {
      safeRevalidate(path);
    }
  }
}

/**
 * Asks the running app to revalidate, for callers with no request scope.
 *
 * Best effort by design: Redis has already been cleared by the time this runs,
 * so the worst case is the pre-existing behaviour of waiting out the ISR
 * timer. It must never fail an edit that has already committed.
 */
async function askAppToRevalidate(slug: string, publicOnly: boolean): Promise<void> {
  const secret = process.env.INTERNAL_API_SECRET;
  const origin = process.env.NEXT_PUBLIC_APP_URL;
  if (!secret || !origin) return;

  try {
    const response = await fetch(`${origin.replace(/\/+$/, "")}/api/internal/revalidate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": secret },
      body: JSON.stringify({ slug, publicOnly }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`[invalidate] revalidation request failed (${response.status})`);
    }
  } catch (error) {
    console.error("[invalidate] could not reach the revalidation route", error);
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

  /**
   * A site with no resolvable slug has no public pages to clear, but the
   * authenticated screens still read its data — so they are refreshed anyway,
   * exactly as before this function learned to reach outside a request.
   */
  if (!resolvedSlug) {
    if (!publicOnly) {
      for (const path of APP_PATHS) safeRevalidate(path);
    }
    return;
  }

  await invalidateSiteCache(resolvedSlug);

  /**
   * Probe with one real path rather than testing for "am I in a request".
   *
   * There is no reliable way to ask that question, and getting it wrong in
   * either direction is silent: a false negative fires a needless HTTP call, a
   * false positive leaves the page stale. `revalidatePath` itself is the
   * authority on whether `revalidatePath` works here.
   */
  if (safeRevalidate(`/sites/${resolvedSlug}`)) {
    revalidateSitePaths(resolvedSlug, { publicOnly });
    return;
  }

  await askAppToRevalidate(resolvedSlug, publicOnly);
}
