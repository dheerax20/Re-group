import type { BlockNode, PageBlocks } from "@/lib/site/blocks/types";
import type { TemplateProfile } from "./types";
import type { TemplateCopy } from "./copy";

/**
 * Band primitives shared by the three templates.
 *
 * Deliberately style-free. A template says what a band contains; the recipe's
 * design pass assigns padding, background, alignment and width afterwards.
 * The one exception the vocabulary allows a template — and not the model — is
 * an EMPTY `image` node: `seedWelcomeImage` fills exactly one of those per
 * page with the direction's stock photograph, so a template asks for a photo
 * by leaving a hole rather than by choosing a URL.
 */

export function band(id: string, children: BlockNode[]): BlockNode {
  return { id, type: "section", children } as BlockNode;
}

export function heading(id: string, text: string, scale: "h1" | "h2" | "h3" = "h2"): BlockNode {
  return { id, type: "heading", scale, text } as BlockNode;
}

export function paragraph(id: string, text: string): BlockNode {
  return { id, type: "text", text } as BlockNode;
}

export function link(id: string, label: string, href: string): BlockNode {
  return { id, type: "button", label, href, emphasis: "primary" } as BlockNode;
}

/** The hole `seedWelcomeImage` fills. One per page — `capEmptyImages` drops the rest. */
export function photoSlot(id: string): BlockNode {
  return { id, type: "image" } as BlockNode;
}

/**
 * The feature bands.
 *
 * `sermonCollection` and `eventCollection` render real rows from the church's
 * own database, so a template supplies only the heading above them. The
 * collection's LAYOUT is not set here either — `applyRecipeToLeaves` assigns
 * it from `recipe.sermons` / `recipe.events`, which is what makes the same
 * band read as a featured hero in Cinematic and a plain list in Traditional.
 *
 * `ensureRequiredBands` would synthesize these if a template forgot one. They
 * are authored anyway, so the heading is in the template's own voice rather
 * than the generic fallback, and so the ORDER is the template's decision.
 */
export function sermonsBand(headingText: string): BlockNode {
  return band("sermons", [
    heading("sermons-heading", headingText),
    { id: "sermons-body", type: "sermonCollection" } as BlockNode,
  ]);
}

export function eventsBand(headingText: string): BlockNode {
  return band("events", [
    heading("events-heading", headingText),
    { id: "events-body", type: "eventCollection" } as BlockNode,
  ]);
}

export function givingBand(headingText: string, body: string): BlockNode {
  return band("giving", [
    heading("giving-heading", headingText),
    paragraph("giving-text", body),
    { id: "giving-cta", type: "givingCta" } as BlockNode,
  ]);
}

export function contactBand(headingText: string, body: string): BlockNode {
  return band("contact", [
    heading("contact-heading", headingText),
    paragraph("contact-text", body),
    { id: "contact-info", type: "contactInfo" } as BlockNode,
  ]);
}

export function ministriesBand(headingText: string, body: string): BlockNode {
  return band("ministries", [
    heading("ministries-heading", headingText),
    paragraph("ministries-text", body),
    { id: "ministries-body", type: "ministryCollection" } as BlockNode,
  ]);
}

/** Where the hero's button points, reused for the closing band's. */
export function closingBand(
  headingText: string,
  copy: TemplateCopy,
  ctaLabel: string
): BlockNode {
  return band("closing", [
    heading("closing-heading", headingText),
    paragraph("closing-text", copy.closingBody),
    link("closing-cta", ctaLabel, copy.hero.ctaHref),
  ]);
}

/** Drops the bands whose feature is switched off. */
export function whenEnabled(
  profile: TemplateProfile,
  entries: Array<[keyof TemplateProfile["features"], BlockNode]>
): PageBlocks {
  return entries.filter(([flag]) => profile.features[flag]).map(([, node]) => node);
}
