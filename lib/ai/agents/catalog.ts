import { sectionVariantOptions } from "@/lib/site/section-variants";
import { sectionTypes, type SectionType } from "@/lib/site/types";
import type { FeatureConfig } from "@/lib/features/types";
import type { DesignRecipe } from "@/lib/site/blocks/design-pass";
import type { LayoutTraits } from "./schemas";

export function variantCatalogForPrompt(): string {
  return sectionTypes
    .map((type) => `${type}: ${sectionVariantOptions[type].join(" | ")}`)
    .join("\n");
}

export function sanitizeVariant(type: SectionType, variant: string): string {
  const options = sectionVariantOptions[type];
  return options.includes(variant) ? variant : options[0];
}

/** Section types whose components read layout traits. Everyone else ignores them. */
export const TRAIT_ELIGIBLE_TYPES: ReadonlySet<SectionType> = new Set([
  "hero",
  "welcome",
  "about",
  "sermons",
  "events",
  "cta",
]);

export type SanitizedTraits = {
  align: "left" | "center";
  density: "compact" | "spacious";
  accent: "none" | "line" | "bordered" | "numbered";
  mediaTreatment: "rounded" | "square" | "framed";
};

/** Clamps a (possibly hallucinated or absent) trait object to safe defaults, same defensive pattern as `sanitizeVariant`. */
export function sanitizeTraits(traits: LayoutTraits | undefined): SanitizedTraits {
  const align = traits?.align === "center" ? "center" : "left";
  const density = traits?.density === "spacious" ? "spacious" : "compact";
  const accent =
    traits?.accent && ["none", "line", "bordered", "numbered"].includes(traits.accent)
      ? traits.accent
      : "none";
  const mediaTreatment =
    traits?.mediaTreatment && ["rounded", "square", "framed"].includes(traits.mediaTreatment)
      ? traits.mediaTreatment
      : "rounded";
  return { align, density, accent, mediaTreatment };
}

/**
 * Named visual directions the crew can commit to.
 *
 * Every generated site used to converge on one structure — transparent navbar,
 * cinematic hero, split welcome, image-right about — because that combination
 * was hard-locked after the fact in `assemble.ts`, on top of a system prompt
 * that already said "heroTreatment MUST be cinematic or fullscreen." Two
 * layers independently erasing variety is why regenerating produced what
 * looked like the same site with different words.
 *
 * These six use the actual registered section variants —
 * `lib/site/section-variants.ts` is the only real catalog; a direction cannot
 * invent a layout no component implements. Variety comes from recombining
 * `navbar` (3 options) × `hero` (4) × `welcome` (2) × `about` (2) ×
 * `sermons`/`events` (3 each) into deliberate, named looks, each with its own
 * mood and copy voice, rather than the model picking fields independently and
 * regressing to whichever one the prompt praised loudest.
 */
export type ArtDirection = {
  id: string;
  name: string;

  /**
   * LEGACY section variants. These name components that no longer exist in the
   * block renderer — `components/website/renderer/section-registry.ts` was
   * deleted with the section layer. They survive for exactly two callers, both
   * on the legacy `sectionConfig` path: `layoutFromFeatures` below and the
   * fallback branch of `lib/ai/agents/assemble.ts`.
   *
   * They must NOT be briefed to the page composer. Doing so is what produced
   * "Locked layout — do not deviate from these: navbar=transparent,
   * hero=cinematic" in a prompt whose renderer implements no such thing: the
   * model spent its instruction budget on a vocabulary that could not reach
   * the page, and the only fields that actually landed were `mood` and
   * `copyVoice`. The block-level recipe below is what replaced them.
   */
  navbar: "transparent" | "solid" | "minimal";
  hero: "split" | "centered" | "fullscreen" | "cinematic";
  welcome: "centered" | "split";
  about: "image-left" | "image-right";
  sermons: "cards" | "featured" | "list";
  events: "grid" | "list" | "calendar";

  /** Fed to the creative director and composer — the visual/typographic mood. */
  mood: string;
  /** Fed to the composer — the voice this direction should read in. */
  copyVoice: string;

  /** The block-level recipe. See `DesignRecipe`. */
  recipe: DesignRecipe;
};

export type { DesignRecipe };

export const ART_DIRECTIONS: ArtDirection[] = [
  {
    id: "cinematic",
    name: "Cinematic",
    navbar: "transparent",
    hero: "cinematic",
    welcome: "split",
    about: "image-left",
    sermons: "featured",
    events: "calendar",
    mood:
      "One dark band carries the page. The hero is quiet and wide, then the room drops to the " +
      "church's own ink for a single section that holds the weight — a sermon, a gathering, one " +
      "sentence. Everything else stays out of its way. Scale does the work, not decoration.",
    copyVoice:
      "Short, declarative lines. Present tense. Let one striking sentence carry the hero " +
      "instead of three ordinary ones.",
    recipe: {
      bandRhythm: ["transparent", "inverted", "transparent", "surface"],
      bandPadding: { hero: "2xl", body: "xl", closing: "2xl" },
      alignPolicy: "centered-close",
      width: "wide",
      hero: {
        archetype: "overlay",
        image: "overlay",
        overlay: "scrim",
        align: "left",
        copyWidth: "wide",
      },
      welcomeImage: "widescreen",
      sermons: "featured",
      events: "calendar",
      image: { treatment: "bleed", aspect: "cinema" },
      eyebrows: "none",
    },
  },
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    navbar: "minimal",
    hero: "centered",
    welcome: "centered",
    about: "image-right",
    sermons: "list",
    events: "list",
    mood:
      "A narrow, ranged-left column, read top to bottom like a letter rather than scanned like " +
      "a landing page. Almost no background changes; the rhythm comes from the space between " +
      "bands and from lists that stay lists instead of becoming cards.",
    copyVoice:
      "Plain, warm, unhurried. No exclamation points. Trust the reader — say less, mean more.",
    recipe: {
      bandRhythm: ["transparent", "transparent", "surface", "transparent"],
      bandPadding: { hero: "xl", body: "lg", closing: "xl" },
      alignPolicy: "left",
      width: "normal",
      hero: {
        archetype: "stacked",
        image: "widescreen",
        copyWidth: "narrow",
        photoWidth: "full",
        treatment: "square",
        aspect: "cinema",
      },
      welcomeImage: "vertical",
      sermons: "list",
      events: "list",
      image: { treatment: "square", aspect: "wide" },
      eyebrows: "none",
    },
  },
  {
    id: "warm-editorial",
    name: "Warm Editorial",
    navbar: "solid",
    hero: "split",
    welcome: "split",
    about: "image-left",
    sermons: "cards",
    events: "grid",
    /**
     * Deliberately steered off the cream-ground / high-contrast-serif /
     * terracotta-accent combination. That trio is one of the three looks that
     * read as machine-generated on sight, and it is what this direction used
     * to brief for almost word for word.
     */
    mood:
      "Magazine layout logic: asymmetric two-column splits, a portrait held in a frame beside " +
      "the text rather than behind it, and headings ranged left against a hard column edge. " +
      "The page is built from the grid, not from a cream background and a display serif.",
    copyVoice:
      "Narrative and specific. Name real details of this church's life — a street, a Sunday " +
      "ritual, a founding story — rather than generic churchy language.",
    recipe: {
      bandRhythm: ["transparent", "surface", "transparent", "primary"],
      bandPadding: { hero: "xl", body: "xl", closing: "lg" },
      alignPolicy: "left",
      width: "wide",
      hero: { archetype: "split", image: "vertical", split: "wide-left" },
      welcomeImage: "widescreen",
      sermons: "grid",
      events: "grid",
      image: { treatment: "framed", aspect: "portrait" },
      eyebrows: "hero-only",
    },
  },
  {
    id: "bright-welcoming",
    name: "Bright & Welcoming",
    navbar: "solid",
    hero: "fullscreen",
    welcome: "centered",
    about: "image-right",
    sermons: "cards",
    events: "grid",
    mood:
      "Photo-forward and centred, built around an invitation rather than an announcement. The " +
      "brand accent appears once, as a full band about a third of the way down, and nowhere " +
      "else. Big friendly type; community over ceremony.",
    copyVoice:
      "Second person, direct, upbeat. Talk TO the visitor ('you'), not about the church in the " +
      "third person.",
    recipe: {
      bandRhythm: ["transparent", "accent", "transparent", "surface"],
      bandPadding: { hero: "2xl", body: "lg", closing: "xl" },
      alignPolicy: "centered-close",
      width: "wide",
      hero: {
        archetype: "stacked",
        image: "widescreen",
        copyWidth: "normal",
        photoWidth: "normal",
        treatment: "rounded",
        aspect: "wide",
      },
      welcomeImage: "vertical",
      sermons: "grid",
      events: "grid",
      image: { treatment: "rounded", aspect: "video" },
      eyebrows: "hero-only",
    },
  },
  {
    id: "traditional-reverent",
    name: "Traditional & Reverent",
    navbar: "transparent",
    hero: "split",
    welcome: "centered",
    about: "image-right",
    sermons: "list",
    events: "calendar",
    mood:
      "Measured and symmetrical. A narrow column, bands that alternate their alignment so the " +
      "page reads as a series of considered pages rather than one scroll, and dates and times " +
      "given plainly. Dignity over trend — this should still look right in ten years.",
    copyVoice:
      "Formal but never cold. Rooted in continuity — heritage, steadiness, belonging across " +
      "generations — without sounding like a museum plaque.",
    recipe: {
      bandRhythm: ["transparent", "surface", "transparent", "surface"],
      bandPadding: { hero: "xl", body: "lg", closing: "lg" },
      alignPolicy: "alternating",
      width: "normal",
      hero: {
        archetype: "overlay",
        image: "overlay",
        overlay: "dark",
        align: "center",
        copyWidth: "narrow",
      },
      welcomeImage: "vertical",
      sermons: "list",
      events: "calendar",
      image: { treatment: "square", aspect: "portrait" },
      eyebrows: "none",
    },
  },
  {
    id: "community-forward",
    name: "Community Forward",
    navbar: "minimal",
    hero: "split",
    welcome: "split",
    about: "image-left",
    sermons: "cards",
    events: "grid",
    mood:
      "People-first and ranged left. Sections built around faces and gathering rather than " +
      "architecture, square portraits at a consistent size, and a two-column rhythm that never " +
      "lets one band overwhelm the page.",
    copyVoice:
      "Conversational, specific about who gathers here — families, students, neighbors — and " +
      "what a first visit actually feels like.",
    recipe: {
      bandRhythm: ["transparent", "surface", "accent", "transparent"],
      bandPadding: { hero: "xl", body: "lg", closing: "xl" },
      alignPolicy: "left",
      width: "wide",
      hero: { archetype: "split", image: "vertical", split: "wide-right" },
      welcomeImage: "widescreen",
      sermons: "grid",
      events: "list",
      image: { treatment: "rounded", aspect: "square" },
      eyebrows: "none",
    },
  },
];


/** A tasteful pick, steered away from whatever was used last time. */
export function pickArtDirection(avoidId?: string): ArtDirection {
  const pool = avoidId
    ? ART_DIRECTIONS.filter((direction) => direction.id !== avoidId)
    : ART_DIRECTIONS;
  const options = pool.length > 0 ? pool : ART_DIRECTIONS;
  return options[Math.floor(Math.random() * options.length)];
}

export function artDirectionById(id: string | undefined): ArtDirection | undefined {
  return ART_DIRECTIONS.find((direction) => direction.id === id);
}

/**
 * Recovers a direction from the display name stored on a previous build
 * (`SiteImprovement`/`styleName` on the site record). Used only to find what
 * to avoid repeating — `styleName` is the direction's own `name`, so this is
 * an exact match, not fuzzy matching against free text the model wrote.
 */
export function artDirectionByName(name: string | undefined): ArtDirection | undefined {
  return ART_DIRECTIONS.find((direction) => direction.name === name);
}

/** One line per direction, for the prompt — names and moods, not the raw variant fields. */
export function artDirectionsForPrompt(): string {
  return ART_DIRECTIONS.map(
    (direction) => `${direction.name}: ${direction.mood}`
  ).join("\n");
}

export function layoutFromFeatures(
  features: FeatureConfig,
  direction: ArtDirection
): Array<{ type: SectionType; variant: string }> {
  const sections: Array<{ type: SectionType; variant: string }> = [
    { type: "navbar", variant: direction.navbar },
    { type: "hero", variant: direction.hero },
    { type: "welcome", variant: direction.welcome },
  ];

  if (features.sermons) sections.push({ type: "sermons", variant: direction.sermons });
  if (features.events) sections.push({ type: "events", variant: direction.events });

  sections.push({ type: "about", variant: direction.about });

  if (features.ministries) sections.push({ type: "ministries", variant: "grid" });
  if (features.giving) sections.push({ type: "giving", variant: "centered" });
  if (features.youtube) sections.push({ type: "youtube", variant: "featured" });
  if (features.podcast) sections.push({ type: "podcast", variant: "featured" });
  if (features.contact) sections.push({ type: "contact", variant: "standard" });

  sections.push({ type: "cta", variant: "full-width" });
  sections.push({ type: "footer", variant: "standard" });

  return sections;
}

export function profileForAgents(input: {
  churchName: string;
  tagline?: string;
  denomination?: string;
  congregationSize?: number;
  features: FeatureConfig;
  story?: {
    city?: string;
    worshipStyle?: string;
    serviceTimes?: string;
    pastorName?: string;
    mission?: string;
    values?: string;
  };
  brand: {
    colors: { primary: string; secondary: string; accent?: string };
    typography: { primaryFont: string; secondaryFont?: string };
  };
}): string {
  return JSON.stringify(
    {
      churchName: input.churchName,
      tagline: input.tagline,
      denomination: input.denomination,
      congregationSize: input.congregationSize,
      city: input.story?.city,
      worshipStyle: input.story?.worshipStyle,
      serviceTimes: input.story?.serviceTimes,
      pastorName: input.story?.pastorName,
      mission: input.story?.mission,
      values: input.story?.values,
      features: input.features,
      brand: input.brand,
    },
    null,
    2
  );
}
