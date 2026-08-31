import { cinematicTemplate } from "./cinematic";
import { traditionalTemplate } from "./traditional";
import { warmEditorialTemplate } from "./warm-editorial";
import { pickHeroImage } from "@/lib/site/blocks/hero";
import type { SiteTemplate, SiteTemplateId } from "./types";

export type { SiteTemplate, SiteTemplateId, TemplateProfile } from "./types";
export { templateProfile } from "./profile";

/**
 * The registry, in the order the picker shows them.
 *
 * A fixed list in code, not a database table. Every other "resolve a component
 * from a stored value" surface in this app is a fixed switch for the same
 * reason (`block-renderer.tsx`), and a template that is code can be
 * type-checked against `BlockNode` and unit-tested — neither of which a JSON
 * blob in a row can be.
 */
export const SITE_TEMPLATES: SiteTemplate[] = [
  cinematicTemplate,
  traditionalTemplate,
  warmEditorialTemplate,
];

export const SITE_TEMPLATE_IDS = SITE_TEMPLATES.map((t) => t.id) as [
  SiteTemplateId,
  ...SiteTemplateId[],
];

export function isSiteTemplateId(id: string | undefined | null): id is SiteTemplateId {
  return SITE_TEMPLATES.some((template) => template.id === id);
}

export function siteTemplateById(id: string | undefined | null): SiteTemplate | undefined {
  return SITE_TEMPLATES.find((template) => template.id === id);
}

/** What the picker needs to draw one card. */
export type TemplateCard = {
  id: SiteTemplateId;
  name: string;
  tagline: string;
  previewImage: string;
};

/**
 * The three cards, with the photograph each template would actually use.
 *
 * `pickHeroImage` is a deterministic hash of the site id, so this is the real
 * picture rather than a stand-in — and it takes the same `avoid` the apply
 * path takes, so the card and the result cannot disagree. Re-applying the
 * template already in use keeps its photograph (nothing to avoid); switching
 * to another one changes it.
 *
 * Resolved on the server so the registry — and through it the design pass and
 * the art-direction catalog — never reaches the browser bundle.
 */
export function templateCards(
  siteId: string,
  opts: { currentTemplateId?: string; previousHeroImage?: string } = {}
): TemplateCard[] {
  return SITE_TEMPLATES.map((template) => ({
    id: template.id,
    name: template.name,
    tagline: template.tagline,
    previewImage: pickHeroImage(
      template.recipe.hero.image,
      siteId,
      template.id === opts.currentTemplateId ? undefined : opts.previousHeroImage
    ),
  }));
}
