import {
  Calendar,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  type LucideIcon,
  Mic2,
  PanelsTopLeft,
  Settings,
  Users,
} from "lucide-react";

/**
 * The shape of the product, in one place.
 *
 * The sidebar renders it and the top bar derives its breadcrumb from it, so a
 * route can never be called one thing in the nav and another above the page.
 *
 * The hierarchy is deliberately shallow. A church is doing one of three
 * things: shaping the website, keeping content current, or looking after the
 * congregation. Everything about the website — the editor, its pages, its
 * domain, the Slack channel that edits it — hangs off **Website Builder**
 * rather than sitting beside it as four sibling settings screens, which is
 * what made the old "Site setup → Pages & links" read like an engineering
 * console.
 *
 * There are no `?siteId=` parameters here. One account owns one website, so
 * the site comes from the session; threading an id through every link only
 * created a second, spoofable source of truth.
 */

export type NavLeaf = {
  href: string;
  label: string;
  icon?: LucideIcon;
  match?: "exact" | "prefix";
  soon?: boolean;
  /**
   * Opens in a new tab. Used for hand-offs to another product (Courses lives
   * in GoHighLevel), so the user keeps their Regroup work in the current tab.
   * The href stays internal — the route itself owns the redirect.
   */
  newTab?: boolean;
};

export type NavItem = NavLeaf & {
  icon: LucideIcon;
  items?: NavLeaf[];
};

export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Website",
    items: [
      {
        href: "/dashboard",
        label: "Overview",
        icon: LayoutDashboard,
        match: "exact",
      },
      {
        href: "/dashboard/website",
        label: "Website Builder",
        icon: PanelsTopLeft,
        items: [
          { href: "/dashboard/website", label: "Website", match: "exact" },
          { href: "/dashboard/domains", label: "Domains" },
          { href: "/dashboard/slack", label: "Slack" },
        ],
      },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/events", label: "Events", icon: Calendar },
      { href: "/sermons", label: "Sermons", icon: Mic2 },
    ],
  },
  {
    label: "Congregation",
    items: [
      { href: "/members", label: "Members", icon: Users, soon: true },
      { href: "/courses", label: "Courses", icon: GraduationCap, newTab: true },
    ],
  },
  {
    label: "Settings",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

/**
 * Routes the sidebar does NOT list but the breadcrumb still has to name.
 *
 * Pages, in particular, is reached from Website Builder rather than from the
 * nav — it is one of the things a website *has*, not a separate destination.
 */
const EXTRA_ROUTES: Array<{
  href: string;
  label: string;
  parent?: string;
  icon?: LucideIcon;
}> = [
  { href: "/dashboard/pages", label: "Pages", parent: "/dashboard/website" },
  { href: "/dashboard/builder", label: "Editor", parent: "/dashboard/website" },
  { href: "/dashboard/profile", label: "Profile", parent: "/settings" },
  { href: "/settings/billing", label: "Billing & plan", parent: "/settings", icon: CreditCard },
];

/**
 * Routes that take over the whole viewport.
 *
 * Two screens in the product are *workflows*, not pages: the website editor,
 * and event check-in. Both are used with a single task in mind — one at a desk
 * for an hour, one standing in a foyer with a phone in one hand — and the
 * sidebar, breadcrumb and page container are pure interference there. The
 * sidebar, the chrome and the shell gate all read this one predicate so they
 * cannot disagree about which screens those are.
 */
export function isImmersiveRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard/builder") ||
    /^\/events\/[^/]+\/checkin$/.test(pathname)
  );
}

export type Crumb = { label: string; href?: string };

/**
 * "Website › Website Builder › Website" is noise, not orientation. A group, a
 * parent and a leaf can legitimately share a name (Settings), so the trail
 * keeps the LAST occurrence of each label — the one closest to the page.
 */
function dedupe(crumbs: Crumb[]): Crumb[] {
  return crumbs.filter(
    (crumb, index) => !crumbs.slice(index + 1).some((later) => later.label === crumb.label)
  );
}

function leaves(): Array<{ leaf: NavLeaf; group: string; parent?: NavItem }> {
  const out: Array<{ leaf: NavLeaf; group: string; parent?: NavItem }> = [];
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      out.push({ leaf: item, group: group.label });
      for (const child of item.items ?? []) {
        out.push({ leaf: child, group: group.label, parent: item });
      }
    }
  }
  return out;
}

/**
 * The trail shown in the top bar.
 *
 * Longest-prefix wins, so `/events/abc/checkin` resolves through Events rather
 * than falling back to the group name. Unknown deep segments contribute a
 * final crumb only when the page supplies one (`pageLabel`), because guessing
 * a title from a cuid is worse than showing none.
 */
export function crumbsFor(pathname: string): Crumb[] {
  const all = leaves();

  let best: { leaf: NavLeaf; group: string; parent?: NavItem } | undefined;
  for (const entry of all) {
    const href = entry.leaf.href;
    const hit =
      entry.leaf.match === "exact"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`);
    if (!hit) continue;
    if (!best || href.length > best.leaf.href.length) best = entry;
  }

  const extra = EXTRA_ROUTES.filter(
    (route) => pathname === route.href || pathname.startsWith(`${route.href}/`)
  ).sort((a, b) => b.href.length - a.href.length)[0];

  if (extra) {
    const parent = all.find((entry) => entry.leaf.href === extra.parent);
    const crumbs: Crumb[] = [];
    if (parent) {
      crumbs.push({ label: parent.group });
      if (parent.parent) {
        crumbs.push({ label: parent.parent.label, href: parent.parent.href });
      }
      crumbs.push({ label: parent.leaf.label, href: parent.leaf.href });
    }
    crumbs.push({ label: extra.label });
    return dedupe(crumbs);
  }

  if (!best) return [];

  const crumbs: Crumb[] = [{ label: best.group }];
  if (best.parent) crumbs.push({ label: best.parent.label, href: best.parent.href });
  crumbs.push({ label: best.leaf.label });
  return dedupe(crumbs);
}
