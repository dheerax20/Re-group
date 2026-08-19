import type { FeatureConfig } from "@/lib/features/types";
import { generateNavigation } from "@/lib/site/navigation";
import { mergeNavigation } from "@/lib/site/pages";
import { sectionTypes, type SectionInstance, type SectionType } from "@/lib/site/types";
import type { BlockNode } from "@/lib/site/blocks/types";
import { coerceBlocks, defaultNavBlock, defaultFooterBlock } from "@/lib/site/blocks/schema";
import { composeSectionCopy } from "@/lib/ai/section-copy";
import type { SiteGenerationInput, GeneratedSiteConfig } from "@/lib/ai/types";
import {
  layoutFromFeatures,
  sanitizeVariant,
  sanitizeTraits,
  TRAIT_ELIGIBLE_TYPES,
  type ArtDirection,
} from "./catalog";
import type { CopyDeck, LayoutPlan, PageComposerOutput, QaReport } from "./schemas";

const REQUIRED: SectionType[] = ["navbar", "hero", "footer"];

function allowedType(type: SectionType, features: FeatureConfig): boolean {
  if (type === "sermons") return features.sermons;
  if (type === "events") return features.events;
  if (type === "ministries") return features.ministries;
  if (type === "giving") return features.giving;
  if (type === "youtube") return features.youtube;
  if (type === "podcast") return features.podcast;
  if (type === "contact") return features.contact;
  return true;
}

/**
 * The only two rules enforced here are real defects, not style preferences.
 *
 * This used to also force hero to cinematic/fullscreen, welcome to split, and
 * navbar's minimal option to transparent — a second, code-level lock on top
 * of a system prompt that already pushed every build toward one look, which
 * between them is why regenerating a site kept producing the same structure.
 * Sanitizing unknown values and the two legibility fixes below are the parts
 * of that function that were ever actually load-bearing; everything else was
 * taste, and taste now belongs to the chosen `ArtDirection`, not a hard lock.
 */
function enforceLegibility(sections: Array<{ type: SectionType; variant: string }>) {
  const navbar = sections.find((row) => row.type === "navbar");
  const hero = sections.find((row) => row.type === "hero");
  if (!navbar || !hero) return;

  // NavbarTransparent renders `position: absolute` over whatever is below it
  // in white/light text — legible only when the hero underneath is a
  // full-bleed treatment (split, fullscreen, cinematic). HeroCentered's own
  // background is the page background with only a faded decorative band, so
  // transparent text over it can fail contrast entirely.
  const FULL_BLEED_HEROES = new Set(["split", "fullscreen", "cinematic"]);
  if (navbar.variant === "transparent" && !FULL_BLEED_HEROES.has(hero.variant)) {
    navbar.variant = "solid";
  }
}

function cleanVariant(type: SectionType, variant: string): string {
  return sanitizeVariant(type, variant);
}

export function assembleGeneratedSite(args: {
  input: SiteGenerationInput;
  direction: ArtDirection;
  layout?: LayoutPlan;
  copy?: CopyDeck;
  qa?: QaReport;
}): GeneratedSiteConfig {
  const { input, direction, layout, copy, qa } = args;
  const fallback = layoutFromFeatures(input.features, direction);

  /**
   * The six section types a direction actually defines a look for. Their
   * variant comes from `direction`, full stop — never from the model.
   *
   * This is the fix for regenerating producing the same site: it used to be
   * the model's job to pick these, constrained only by a prompt telling it
   * what to prefer, and models reliably follow "prefer cinematic" by
   * preferring cinematic every time. `direction` is chosen once per build
   * with `pickArtDirection()`, which explicitly avoids repeating whatever the
   * previous build used — so the structural look now genuinely varies, and
   * varies predictably, instead of depending on the model doing something
   * different each time.
   *
   * What the model keeps real creative control over: which optional sections
   * (ministries, giving, youtube, podcast, contact) appear and in what order
   * — via `layout.sections` — plus every word of the copy.
   */
  const LOCKED: Partial<Record<SectionType, string>> = {
    navbar: direction.navbar,
    hero: direction.hero,
    welcome: direction.welcome,
    about: direction.about,
    sermons: direction.sermons,
    events: direction.events,
  };

  const planned = (layout?.sections ?? fallback)
    .filter((row) => sectionTypes.includes(row.type) && allowedType(row.type, input.features))
    .map((row) => ({
      type: row.type,
      variant: LOCKED[row.type] ?? cleanVariant(row.type, row.variant),
    }));

  // Still applied for the handful of section types that aren't direction-locked
  // (their component only has one registered variant anyway, so this is a
  // no-op in practice, but it keeps a hallucinated QA fix from doing anything
  // odd rather than relying on that being true forever).
  for (const fix of qa?.variantFixes ?? []) {
    if (LOCKED[fix.type]) continue;
    const match = planned.find((row) => row.type === fix.type);
    if (match) match.variant = cleanVariant(fix.type, fix.variant);
  }

  const seen = new Set<SectionType>();
  const unique = planned.filter((row) => {
    if (seen.has(row.type)) return false;
    seen.add(row.type);
    return true;
  });

  for (const required of REQUIRED) {
    if (!unique.some((row) => row.type === required)) {
      const seed = fallback.find((row) => row.type === required);
      if (seed) unique.unshift({ ...seed, variant: cleanVariant(seed.type, seed.variant) });
    }
  }

  // Ensure welcome + about exist for a complete church homepage.
  for (const needed of ["welcome", "about", "cta"] as SectionType[]) {
    if (!unique.some((row) => row.type === needed)) {
      const seed = fallback.find((row) => row.type === needed);
      if (seed) {
        const footerIndex = unique.findIndex((row) => row.type === "footer");
        const insertAt = footerIndex === -1 ? unique.length : footerIndex;
        unique.splice(insertAt, 0, {
          ...seed,
          variant: cleanVariant(seed.type, seed.variant),
        });
      }
    }
  }

  // The one real defect check — navbar legibility against whatever hero the
  // AI (or the fallback) actually settled on. Everything else about the look
  // is `direction`'s call, not this function's.
  enforceLegibility(unique);

  if (unique[0]?.type !== "navbar") {
    unique.sort((a, b) => {
      if (a.type === "navbar") return -1;
      if (b.type === "navbar") return 1;
      if (a.type === "footer") return 1;
      if (b.type === "footer") return -1;
      return 0;
    });
  }

  const footer = unique.filter((row) => row.type === "footer");
  const rest = unique.filter((row) => row.type !== "footer");
  const ordered = [...rest, ...footer].slice(0, 12);

  let sections: SectionInstance[] = ordered.map((row, index) => ({
    id: `${row.type}-${index}`,
    type: row.type,
    variant: row.variant,
    enabled: true,
    config: {},
  }));

  sections = composeSectionCopy(input, sections);

  if (copy) {
    const byType = new Map(copy.sections.map((item) => [item.type, item]));
    sections = sections.map((section) => {
      const overlay = byType.get(section.type);
      const config = { ...section.config };
      if (overlay?.eyebrow?.trim()) config.eyebrow = overlay.eyebrow.trim();
      if (overlay?.title?.trim()) config.title = overlay.title.trim();
      if (overlay?.description?.trim()) config.description = overlay.description.trim();
      if (section.type === "hero") {
        config.stats = copy.stats;
        config.primaryCta = {
          label: overlay?.ctaLabel?.trim() || "Plan your visit",
          href: overlay?.ctaHref?.trim() || "/contact",
        };
      }
      if (section.type === "cta") {
        config.cta = {
          label: overlay?.ctaLabel?.trim() || "Plan your visit",
          href: overlay?.ctaHref?.trim() || "/contact",
        };
      }
      if (section.type === "ministries") {
        config.items = copy.ministries;
      }
      return { ...section, config };
    });
  }

  // Structural traits (alignment, density, accent, media treatment) — how a
  // section renders beyond its locked/chosen variant. Only meaningful for
  // the types in TRAIT_ELIGIBLE_TYPES; sanitized against hallucinated or
  // missing values the same way variants are.
  if (layout) {
    const traitsByType = new Map(layout.sections.map((item) => [item.type, item.traits]));
    sections = sections.map((section) => {
      if (!TRAIT_ELIGIBLE_TYPES.has(section.type)) return section;
      const traits = sanitizeTraits(traitsByType.get(section.type));
      return {
        ...section,
        config: {
          ...section.config,
          align: traits.align,
          density: traits.density,
          accent: traits.accent,
          mediaTreatment: traits.mediaTreatment,
        },
      };
    });
  }

  // Photos are left empty — the church provides their own images in the editor.
  sections = sections.map((section) => {
    if (!["hero", "welcome", "about", "cta"].includes(section.type)) return section;
    return {
      ...section,
      config: {
        ...section.config,
        imageUrl: "",
        mediaLabel: "Add your photo",
      },
    };
  });

  const seo = copy
    ? { title: copy.seoTitle, description: copy.seoDescription }
    : {
        title: `${input.churchName}${input.tagline ? ` — ${input.tagline}` : ""}`,
        description:
          input.story?.mission ||
          input.tagline ||
          `${input.churchName} is a church community. Join us for worship, sermons, and events.`,
      };

  return {
    sections,
    navigation: mergeNavigation(input.features, generateNavigation(input.features)),
    seo,
  };
}

/**
 * The page-composer path: the AI already wrote the layout as a block tree
 * (`runComposer`), so there's no variant-locking or copy-overlay step here —
 * just safety. `coerceBlocks` repairs/validates the model's raw output, and
 * a nav/footer band is injected if the model omitted the reserved
 * `id: "nav"` / `id: "footer"` blocks the public layout looks for.
 */
export function assembleGeneratedBlocks(args: {
  input: SiteGenerationInput;
  composed: PageComposerOutput;
}): GeneratedSiteConfig & { blocks: BlockNode[] } {
  const { input, composed } = args;

  let blocks = coerceBlocks(composed.blocks);

  // Nav + footer alone is not a homepage. `pageComposerResponseSchema` repairs
  // whatever it can out of the model's reply rather than throwing, so an
  // unusable reply arrives here as an empty tree instead of an exception —
  // this is the point where that has to become a failed job, not a blank site
  // published over the church's existing one.
  if (blocks.length === 0) {
    throw new Error("The AI returned an unusable layout. Try again.");
  }

  if (!blocks.some((b) => b.id === "nav")) blocks = [defaultNavBlock(), ...blocks];
  if (!blocks.some((b) => b.id === "footer")) blocks = [...blocks, defaultFooterBlock()];

  return {
    sections: [],
    blocks,
    navigation: mergeNavigation(input.features, generateNavigation(input.features)),
    // Same reason as `blocks`: the SEO strings are best-effort on the reply,
    // and an empty <title> is worse than a plain one built from what the
    // church already told us.
    seo: {
      title:
        composed.seoTitle ||
        `${input.churchName}${input.tagline ? ` — ${input.tagline}` : ""}`,
      description:
        composed.seoDescription ||
        input.story?.mission ||
        input.tagline ||
        `${input.churchName} is a church community. Join us for worship, sermons, and events.`,
    },
  };
}
