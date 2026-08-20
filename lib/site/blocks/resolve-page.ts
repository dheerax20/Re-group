import type { PageBlocks } from "./types";
import type { SiteConfig } from "@/lib/site/types";
import { defaultPageBlocks } from "./default-pages";

export const HOME_PATH = "/";

/**
 * Where one page's block tree comes from.
 *
 * This is the single place the home/secondary asymmetry lives, and it is
 * deliberate: the homepage stays on `Site.blockConfig` while every other page
 * lives in a `SitePage` row. `blockConfig` carries the whole
 * `blockConfig ?? sectionConfig` legacy bridge and is the one content path
 * that already works end to end; relocating it purely for symmetry would put
 * that at risk for no user-visible gain.
 *
 * Everything else funnels through here, so no caller has to know.
 */
export function getPageBlocks(site: SiteConfig, path: string): PageBlocks {
  if (path === HOME_PATH) return site.blocks;

  /**
   * Key PRESENCE is the signal, not length.
   *
   * `toSiteConfig` only adds a key when a `SitePage` row exists, so an empty
   * array here means the church deliberately emptied that page — and falling
   * back to the default then would silently resurrect content they deleted,
   * permanently, since every later edit would start from the default again.
   * A missing key is the real "never edited" case.
   */
  const stored = site.pages?.[path];
  return stored !== undefined ? stored : defaultPageBlocks(path, site);
}

/**
 * Whether a page has been edited yet.
 *
 * Callers that need to know the difference between "the church shaped this
 * page" and "this is still the default" (the editor's own copy, for instance)
 * ask here rather than comparing trees.
 */
export function hasStoredPage(site: SiteConfig, path: string): boolean {
  if (path === HOME_PATH) return site.blocks.length > 0;
  return site.pages?.[path] !== undefined;
}
