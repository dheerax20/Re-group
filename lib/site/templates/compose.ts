import { applyDesignPass, type DesignRecipe } from "@/lib/site/blocks/design-pass";
import { defaultFooterBlock, defaultNavBlock } from "@/lib/site/blocks/schema";
import type { PageBlocks } from "@/lib/site/blocks/types";
import type { TemplateCopy } from "./copy";
import type { TemplateProfile } from "./types";

/**
 * The one place a template's authored bands become a finished page.
 *
 * This is the template path's `assembleGeneratedBlocks`
 * (`lib/ai/agents/assemble.ts`), minus everything to do with a model. Both
 * paths end in the same `applyDesignPass` call with the same recipe, which is
 * why a template site and an AI site look like the same product.
 */
export function composeHome(
  blocks: PageBlocks,
  profile: TemplateProfile,
  copy: TemplateCopy,
  recipe: DesignRecipe
): PageBlocks {
  // Nav first so `injectHero` puts the hero directly beneath it; footer last
  // so `ensureRequiredBands` inserts before it rather than after.
  const withChrome = [defaultNavBlock(), ...blocks, defaultFooterBlock()];

  return applyDesignPass(
    withChrome,
    {
      // `RequiredBandContext.features` is an open record because the design
      // pass also runs over legacy sites whose flags were never typed.
      features: { ...profile.features },
      churchName: profile.churchName,
      story: { mission: profile.story.mission, values: profile.story.values },
      tagline: profile.tagline,
      // Presence is what gates hero injection — the template always supplies
      // it, so a template page always gets its photograph.
      hero: copy.hero,
      siteId: profile.siteId,
      previousHeroImage: profile.previousHeroImage,
    },
    recipe
  );
}

/**
 * A secondary page, run through the same recipe so it matches the homepage.
 *
 * Given `siteId` and nothing else. With no `hero` no hero is injected, and
 * with no `features`, `churchName` or `story`, `ensureRequiredBands`
 * synthesizes nothing — otherwise `/contact` would grow a sermons band and an
 * "About us" band it never asked for. `siteId` is still needed because
 * `seedWelcomeImage` uses it to pick this church's photograph for the about
 * page, and without it every church would get the same one.
 *
 * A secondary page carries no nav or footer: the public layout renders those
 * once from `site.blocks` (`app/sites/[siteSlug]/layout.tsx`).
 */
export function composeSecondary(
  blocks: PageBlocks,
  profile: TemplateProfile,
  recipe: DesignRecipe
): PageBlocks {
  return applyDesignPass(blocks, { siteId: profile.siteId }, recipe);
}
