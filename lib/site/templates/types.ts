import type { DesignRecipe } from "@/lib/site/blocks/design-pass";
import type { PageBlocks } from "@/lib/site/blocks/types";
import type { NavVariant } from "@/lib/site/types";
import type { ChurchStory } from "@/lib/site/story";
import type { FeatureConfig } from "@/lib/features/types";
import type { BrandConfig } from "@/lib/theme/types";

/**
 * A pre-built design a church can choose instead of paying for an AI build.
 *
 * The wizard's "Design" step used to auto-start the LangChain crew. Everything
 * that crew invents about layout is already decided by an `ArtDirection`'s
 * recipe, and everything it invents about copy is a rearrangement of the
 * answers the church typed into the four steps before it. For a church that
 * wants a good site rather than a surprising one, an LLM is an expensive way
 * to arrange facts we already hold.
 *
 * So a template is the same shape as a crew reply, written by hand: a page of
 * bands with real words in them. It goes through the identical
 * `applyDesignPass` the AI path uses, which is what keeps the two products
 * looking like one product.
 *
 * The division of labour is the same as everywhere else in the design layer:
 * a template decides WHAT IS ON THE PAGE and WHAT IT SAYS. The recipe decides
 * what it looks like. A template must not emit `padding`, `background`,
 * `align` or `width` — the same rule the composer prompt puts on the model.
 */
export type SiteTemplateId = "cinematic" | "traditional" | "warm-editorial";

/**
 * Everything a template is allowed to read about a church.
 *
 * Built from a `SiteConfig`, so it has already crossed `to-site-config.ts` —
 * the one boundary where `Json` columns become typed values. A template never
 * sees a Prisma row and so cannot be broken by one bad field.
 */
export type TemplateProfile = {
  /** Seeds the deterministic stock-photo choice, exactly as a build does. */
  siteId: string;
  churchName: string;
  tagline?: string;
  denomination?: string;
  story: ChurchStory;
  features: FeatureConfig;
  brand: BrandConfig;
  /** The photo the last design used, so switching template changes the picture. */
  previousHeroImage?: string;
};

export type SiteTemplate = {
  id: SiteTemplateId;
  /** Also written to `storyConfig.styleName`, which the wizard header shows. */
  name: string;
  /** Written to `Site.templateVersion`. Bump when a template's output changes. */
  version: number;
  /** One line for the picker card. */
  tagline: string;
  /**
   * How the navbar renders. Stored per site at apply time for the same reason
   * a build stores it (`lib/site/story.ts`): editing this table must never
   * restyle a church that is already live.
   */
  navVariant: NavVariant;
  /** Borrowed verbatim from `ART_DIRECTIONS`, so templates and AI builds share a look. */
  recipe: DesignRecipe;
  buildHome(profile: TemplateProfile): PageBlocks;
  /**
   * One of the editable secondary pages, or `null` for a path this template
   * has nothing to say about (which falls back to `defaultPageBlocks`).
   */
  buildPage(path: string, profile: TemplateProfile): PageBlocks | null;
};
