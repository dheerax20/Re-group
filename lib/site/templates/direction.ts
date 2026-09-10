import { ART_DIRECTIONS } from "@/lib/ai/agents/catalog";
import type { DesignRecipe } from "@/lib/site/blocks/design-pass";
import type { NavVariant } from "@/lib/site/types";

/**
 * A template borrows its look from the art direction of the same name.
 *
 * The three templates are deliberately the same three designs the crew can
 * produce, so a church picking "Cinematic" gets the Cinematic the AI would
 * have built — the difference between the two paths is who writes the words,
 * not what the page looks like. It also means one recipe to maintain per look.
 *
 * Safe against the table changing under a live site: the apply path snapshots
 * the finished trees, so editing a recipe only affects designs applied after
 * the deploy. That is the same guarantee `storyConfig.navVariant` gives the
 * navbar (`lib/site/story.ts`).
 *
 * Throws rather than falling back, because a typo here is a build-time bug and
 * silently serving a different design than the church picked is worse than a
 * failure the test suite catches.
 */
export function directionFor(id: string): { recipe: DesignRecipe; navVariant: NavVariant } {
  const direction = ART_DIRECTIONS.find((entry) => entry.id === id);
  if (!direction) throw new Error(`No art direction "${id}" to build a template from`);
  return { recipe: direction.recipe, navVariant: direction.navbar };
}
