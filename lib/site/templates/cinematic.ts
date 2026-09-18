import {
  band,
  closingBand,
  contactBand,
  eventsBand,
  givingBand,
  heading,
  paragraph,
  photoSlot,
  sermonsBand,
} from "./bands";
import { composeHome } from "./compose";
import { resolveTemplateCopy } from "./copy";
import { directionFor } from "./direction";
import { buildTemplatePage, type PageVoice } from "./pages";
import type { SiteTemplate, TemplateProfile } from "./types";

/**
 * Cinematic — the photograph carries the page.
 *
 * The recipe puts the headline over a full-bleed scrimmed image and lifts one
 * band to the church's own colour further down, so the page needs very little
 * else: a single statement about who gathers here, then the two things a
 * visitor came for. Short headings, because a two-word title beside a big
 * photograph reads as confidence and a seven-word one reads as a caption.
 */
const { recipe, navVariant } = directionFor("cinematic");

const VOICE: PageVoice = {
  about: "Who we are",
  values: "What we hold to",
  contact: "Find us",
  giving: "Give",
  ministries: "Get involved",
};

export const cinematicTemplate: SiteTemplate = {
  id: "cinematic",
  name: "Cinematic",
  /**
   * 2, for two changes shipping together:
   *
   * - The rhythm's dark band became a `primary` wash. `inverted` painted the
   *   church's own `foreground`, which nothing validates as dark, so the band
   *   shipped pale with white type on at least one live site.
   * - The seeded welcome photograph moved from a `cinema` box to a `wide` one,
   *   to match the widescreen stock set it is actually drawn from.
   *
   * `applyTemplateToSite` snapshots the finished trees, so a site applied at
   * version 1 keeps both until the template is re-applied — this is what
   * records that they differ.
   */
  version: 2,
  tagline: "One photograph, one band of colour, and as few words as the page can carry.",
  navVariant,
  recipe,

  buildHome(profile: TemplateProfile) {
    const copy = resolveTemplateCopy(profile, { ctaLabel: "Plan your visit" });
    const { features } = profile;

    const blocks = [
      band("welcome", [
        heading("welcome-heading", "Who gathers here"),
        paragraph("welcome-text", copy.aboutBody),
        photoSlot("welcome-photo"),
      ]),
      ...(features.sermons ? [sermonsBand("Listen")] : []),
      ...(features.events ? [eventsBand("What's coming")] : []),
      ...(features.giving ? [givingBand("Give", copy.givingBody)] : []),
      ...(features.contact ? [contactBand("Find us", copy.visitBody)] : []),
      closingBand("Come this Sunday", copy, "Plan your visit"),
    ];

    return composeHome(blocks, profile, copy, recipe);
  },

  buildPage(path: string, profile: TemplateProfile) {
    const copy = resolveTemplateCopy(profile, { ctaLabel: "Plan your visit" });
    return buildTemplatePage(path, profile, copy, VOICE, recipe);
  },
};
