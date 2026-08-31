import type { BlockNode, PageBlocks } from "./types";
import type { SiteConfig } from "@/lib/site/types";

/**
 * The starting block tree for each editable secondary page.
 *
 * These compositions used to be written inline in their route files, rebuilt
 * on every render, which is why nothing could edit them — there was no stored
 * content to change. They live here now and serve two jobs:
 *
 * 1. the seed written to `SitePage` when a site is built, and
 * 2. the render-time fallback when no row exists yet.
 *
 * (2) is what makes this change invisible to every existing site: a church
 * with no `SitePage` rows sees exactly the page it saw before, and only gains
 * a row once something actually edits it. No backfill, no migration of data.
 *
 * Keep them deterministic and grounded in real site fields. Nothing here may
 * invent a claim about a church — the copy below is either the church's own
 * (`brand.tagline`) or generic enough to be true of any congregation.
 *
 * They also have to hold to the same craft floor as an AI-composed page,
 * because a church sees them side by side with one. Two rules earn their
 * place: no `eyebrow` above a heading that already reads clearly (a small
 * tracked-out label above every band is the fastest way a site reads as
 * generated), and no reflexive `align: "center"`. Prose and contact details
 * range left and take a reading measure; giving is the one page that genuinely
 * is a single call to action, so it is the one that stays centred.
 */

function band(id: string, children: BlockNode[], style?: BlockNode["style"]): BlockNode {
  return { id, type: "section", style, children } as BlockNode;
}

function aboutPage(site: SiteConfig): PageBlocks {
  const blocks: PageBlocks = [
    band(
      "about-page",
      [
        { id: "about-heading", type: "heading", text: "Who We Are", scale: "h1" },
        {
          id: "about-text",
          type: "text",
          text:
            site.brand.tagline ||
            `${site.site.name} exists to help people know God and grow in community. We gather to worship, learn, and serve together.`,
        },
      ] as BlockNode[],
      { padding: "xl", align: "left", width: "normal" }
    ),
  ];

  if (site.features.ministries) {
    blocks.push(
      band(
        "about-ministries",
        [
          { id: "ministries-heading", type: "heading", text: "Ministries", scale: "h2" },
          { id: "ministries-collection", type: "ministryCollection" },
        ] as BlockNode[],
        { padding: "lg" }
      )
    );
  }

  return blocks;
}

function contactPage(): PageBlocks {
  return [
    band(
      "contact-page",
      [
        { id: "contact-heading", type: "heading", text: "Contact Us", scale: "h1" },
        { id: "contact-info", type: "contactInfo" },
        { id: "contact-social", type: "socialLinks" },
      ] as BlockNode[],
      { padding: "xl", align: "left", width: "normal" }
    ),
  ];
}

function givingPage(): PageBlocks {
  return [
    band(
      "giving-page",
      [
        { id: "giving-heading", type: "heading", text: "Give Online", scale: "h1" },
        {
          id: "giving-text",
          type: "text",
          text: "Your generosity helps us serve our community and share hope with more people.",
        },
        { id: "giving-cta", type: "givingCta" },
      ] as BlockNode[],
      // `primary` is a 10% wash of the brand, not a solid fill — see
      // components/website/blocks/tokens.ts.
      { padding: "xl", background: "primary", align: "center", width: "narrow" }
    ),
  ];
}

function ministriesPage(): PageBlocks {
  return [
    band(
      "ministries-page",
      [
        { id: "ministries-heading", type: "heading", text: "Ministries", scale: "h1" },
        { id: "ministries-collection", type: "ministryCollection" },
      ] as BlockNode[],
      { padding: "lg" }
    ),
  ];
}

/**
 * The default tree for one page path, or an empty list for a path that has no
 * deterministic composition (the homepage, and the code-rendered sermons and
 * events listings).
 */
export function defaultPageBlocks(path: string, site: SiteConfig): PageBlocks {
  switch (path) {
    case "/about":
      return aboutPage(site);
    case "/contact":
      return contactPage();
    case "/giving":
      return givingPage();
    case "/ministries":
      return ministriesPage();
    default:
      return [];
  }
}
