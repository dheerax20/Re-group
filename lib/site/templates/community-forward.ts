import {
  band,
  closingBand,
  contactBand,
  eventsBand,
  givingBand,
  heading,
  ministriesBand,
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
 * Community Forward — the people, not the building.
 *
 * Its hero is a grid of photographs beside the words rather than one
 * establishing shot behind them, and the page order follows from that: the
 * groups a visitor could join and the things happening this month come BEFORE
 * the sermon archive. Every other template leads with what the church says;
 * this one leads with who is there and what they do.
 *
 * That ordering is the whole template. A direction whose mood is "people-first"
 * and whose homepage opens with a wall of recorded talks is not people-first,
 * whatever its recipe does with the photography.
 */
const { recipe, navVariant } = directionFor("community-forward");

const VOICE: PageVoice = {
  about: "The people here",
  values: "What we're about",
  contact: "Drop us a line",
  giving: "Chip in",
  ministries: "Groups and teams",
};

export const communityForwardTemplate: SiteTemplate = {
  id: "community-forward",
  name: "Community Forward",
  version: 1,
  tagline: "A wall of faces beside the welcome, and the groups you could join up front.",
  navVariant,
  recipe,

  buildHome(profile: TemplateProfile) {
    const copy = resolveTemplateCopy(profile, { ctaLabel: "Come along" });
    const { features } = profile;

    const blocks = [
      band("welcome", [
        heading("welcome-heading", "The people here"),
        paragraph("welcome-text", copy.aboutBody),
        photoSlot("welcome-photo"),
      ]),
      // People before broadcast: the groups, then what is happening, and only
      // then the archive. This is the direction's identity as page order.
      ...(features.ministries ? [ministriesBand("Groups and teams", copy.ministriesBody)] : []),
      ...(features.events ? [eventsBand("This month")] : []),
      ...(features.sermons ? [sermonsBand("Talks")] : []),
      ...(features.giving ? [givingBand("Chip in", copy.givingBody)] : []),
      ...(features.contact ? [contactBand("Drop us a line", copy.contactBody)] : []),
      closingBand("There's a seat with your name on it", copy, "Come along"),
    ];

    return composeHome(blocks, profile, copy, recipe);
  },

  buildPage(path: string, profile: TemplateProfile) {
    const copy = resolveTemplateCopy(profile, { ctaLabel: "Come along" });
    return buildTemplatePage(path, profile, copy, VOICE, recipe);
  },
};
