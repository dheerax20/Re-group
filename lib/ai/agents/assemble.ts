import type { FeatureConfig } from "@/lib/features/types";
import { generateNavigation } from "@/lib/site/navigation";
import { mergeNavigation } from "@/lib/site/pages";
import { sectionTypes, type SectionInstance, type SectionType } from "@/lib/site/types";
import { composeSectionCopy } from "@/lib/ai/section-copy";
import type { SiteGenerationInput, GeneratedSiteConfig } from "@/lib/ai/types";
import { layoutFromFeatures, sanitizeVariant } from "./catalog";
import type { CopyDeck, LayoutPlan, QaReport, ThemeBrief } from "./schemas";

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

/** Enforce a premium church homepage — never a flat grey landing page. */
function aestheticVariant(type: SectionType, variant: string): string {
  let next = sanitizeVariant(type, variant);
  if (type === "hero") {
    if (next === "centered") next = "cinematic";
    if (!["cinematic", "fullscreen", "split"].includes(next)) next = "cinematic";
  }
  if (type === "navbar") {
    // Transparent only works over photo heroes; keep it for cinematic/fullscreen.
    if (next === "minimal") next = "transparent";
  }
  if (type === "welcome" && next === "centered") next = "split";
  if (type === "about" && next !== "image-left" && next !== "image-right") {
    next = "image-right";
  }
  if (type === "events" && next === "calendar") next = "grid";
  return next;
}

export function assembleGeneratedSite(args: {
  input: SiteGenerationInput;
  theme?: ThemeBrief;
  layout?: LayoutPlan;
  copy?: CopyDeck;
  qa?: QaReport;
}): GeneratedSiteConfig {
  const { input, theme, layout, copy, qa } = args;
  const heroTreatment = theme?.heroTreatment ?? "cinematic";
  const fallback = layoutFromFeatures(
    input.features,
    heroTreatment,
    theme?.navbarTreatment === "solid" ? "solid" : "transparent"
  );

  const planned = (layout?.sections ?? fallback)
    .filter((row) => sectionTypes.includes(row.type) && allowedType(row.type, input.features))
    .map((row) => ({
      type: row.type,
      variant: aestheticVariant(row.type, row.variant),
    }));

  for (const fix of qa?.variantFixes ?? []) {
    const match = planned.find((row) => row.type === fix.type);
    if (match) match.variant = aestheticVariant(fix.type, fix.variant);
  }

  // Final aesthetic lock after QA patches.
  for (const row of planned) {
    row.variant = aestheticVariant(row.type, row.variant);
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
      if (seed) unique.unshift({ ...seed, variant: aestheticVariant(seed.type, seed.variant) });
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
          variant: aestheticVariant(seed.type, seed.variant),
        });
      }
    }
  }

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
