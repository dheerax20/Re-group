import type { FeatureConfig } from "@/lib/features/types";
import type { NavigationItem } from "./types";

export type SitePageLink = {
  label: string;
  href: string;
  description: string;
  feature?: keyof FeatureConfig;
  required?: boolean;
};

/** Canonical public pages the website builder can link in navigation. */
export const SITE_PAGE_LINKS: SitePageLink[] = [
  { label: "Home", href: "/", description: "Homepage", required: true },
  { label: "About", href: "/about", description: "Church story" },
  {
    label: "Sermons",
    href: "/sermons",
    description: "Messages library",
    feature: "sermons",
  },
  {
    label: "Events",
    href: "/events",
    description: "Calendar & gatherings",
    feature: "events",
  },
  {
    label: "Ministries",
    href: "/ministries",
    description: "Groups & teams",
    feature: "ministries",
  },
  {
    label: "Give",
    href: "/giving",
    description: "Giving page",
    feature: "giving",
  },
  {
    label: "Contact",
    href: "/contact",
    description: "Visit & contact",
    feature: "contact",
  },
];

export function availableSitePages(features: FeatureConfig): SitePageLink[] {
  return SITE_PAGE_LINKS.filter((page) => {
    if (!page.feature) return true;
    return Boolean(features[page.feature]);
  });
}

export function allowedHrefs(features: FeatureConfig): Set<string> {
  return new Set(availableSitePages(features).map((page) => page.href));
}

/**
 * Keep user labels and order, drop links for disabled features,
 * and append any newly unlocked pages.
 */
export function mergeNavigation(
  features: FeatureConfig,
  current: NavigationItem[]
): NavigationItem[] {
  const allowed = availableSitePages(features);
  const allowedSet = new Set(allowed.map((p) => p.href));
  const catalog = new Map(allowed.map((p) => [p.href, p]));

  const seen = new Set<string>();
  const merged: NavigationItem[] = [];

  for (const item of current) {
    if (!allowedSet.has(item.href) || seen.has(item.href)) continue;
    seen.add(item.href);
    merged.push({
      href: item.href,
      label: item.label.trim() || catalog.get(item.href)?.label || item.href,
    });
  }

  for (const page of allowed) {
    if (seen.has(page.href)) continue;
    merged.push({ href: page.href, label: page.label });
  }

  // Home always leads the navbar. Guarding only on its absence was not enough:
  // when a saved navigation omitted "/", the append loop above added it after
  // the church's own links, so the menu opened on "About" and Home sat second.
  const homeIndex = merged.findIndex((item) => item.href === "/");
  const home =
    homeIndex >= 0 ? merged.splice(homeIndex, 1)[0] : { label: "Home", href: "/" };
  merged.unshift(home);

  return merged;
}
