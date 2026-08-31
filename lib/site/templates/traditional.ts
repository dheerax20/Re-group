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
 * Traditional — measured, symmetrical, and plain about the facts.
 *
 * The recipe holds a narrow measure and alternates each band's alignment, so
 * the page reads as a series of considered pages rather than one scroll. The
 * one structural difference from the other two is a dedicated band for times
 * of worship: a church whose visitors are checking when the service starts
 * should not make them read a hero subhead to find out.
 */
const { recipe, navVariant } = directionFor("traditional-reverent");

const VOICE: PageVoice = {
  about: "Our congregation",
  values: "What we believe",
  contact: "Get in touch",
  giving: "Supporting the church",
  ministries: "Groups and teams",
};

export const traditionalTemplate: SiteTemplate = {
  id: "traditional",
  name: "Traditional",
  version: 1,
  tagline: "A narrow, symmetrical page that gives the times and the welcome plainly.",
  navVariant,
  recipe,

  buildHome(profile: TemplateProfile) {
    const copy = resolveTemplateCopy(profile, { ctaLabel: "Plan your visit" });
    const { features, story } = profile;

    const blocks = [
      band("welcome", [
        heading("welcome-heading", "Our congregation"),
        paragraph("welcome-text", copy.aboutBody),
        photoSlot("welcome-photo"),
      ]),
      band("worship", [
        heading("worship-heading", "Times of worship"),
        paragraph("worship-text", copy.visitBody),
        ...(story.pastorName
          ? [paragraph("worship-pastor", `Led by ${story.pastorName}.`)]
          : []),
      ]),
      ...(features.sermons ? [sermonsBand("Recent messages")] : []),
      ...(features.events ? [eventsBand("Parish calendar")] : []),
      ...(features.ministries
        ? [ministriesBand("Groups and teams", copy.ministriesBody)]
        : []),
      ...(features.giving ? [givingBand("Supporting the church", copy.givingBody)] : []),
      ...(features.contact ? [contactBand("Get in touch", copy.contactBody)] : []),
      closingBand("You are welcome here", copy, "Plan your visit"),
    ];

    return composeHome(blocks, profile, copy, recipe);
  },

  buildPage(path: string, profile: TemplateProfile) {
    const copy = resolveTemplateCopy(profile, { ctaLabel: "Plan your visit" });
    return buildTemplatePage(path, profile, copy, VOICE, recipe);
  },
};
