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
 * Modern Minimal — one photograph, then almost nothing.
 *
 * The leanest of the six on purpose. Cinematic lifts a band to the church's own
 * colour, Traditional adds a dedicated worship-times band, Warm Editorial adds a
 * values band and a visit band — this one adds nothing. Its recipe holds a
 * narrow measure, ranges every band left and (alone among the six) repeats its
 * background rather than alternating, so the page reads top to bottom like a
 * letter. The only way a template can support that is by having fewer things on
 * it.
 *
 * Plain headings for the same reason. "Sermons" over a list of sermons says
 * everything a visitor needs; "From the pulpit" is Warm Editorial's job.
 */
const { recipe, navVariant } = directionFor("modern-minimal");

const VOICE: PageVoice = {
  about: "About this church",
  values: "What matters here",
  contact: "Where to find us",
  giving: "Giving",
  ministries: "Ways in",
};

export const modernMinimalTemplate: SiteTemplate = {
  id: "modern-minimal",
  name: "Modern Minimal",
  version: 1,
  tagline: "One photograph, a narrow column, and nothing that does not earn its place.",
  navVariant,
  recipe,

  buildHome(profile: TemplateProfile) {
    const copy = resolveTemplateCopy(profile, { ctaLabel: "Plan your visit" });
    const { features } = profile;

    const blocks = [
      band("welcome", [
        heading("welcome-heading", "About this church"),
        paragraph("welcome-text", copy.aboutBody),
        photoSlot("welcome-photo"),
      ]),
      ...(features.sermons ? [sermonsBand("Sermons")] : []),
      ...(features.events ? [eventsBand("What's on")] : []),
      ...(features.ministries ? [ministriesBand("Ways in", copy.ministriesBody)] : []),
      ...(features.giving ? [givingBand("Giving", copy.givingBody)] : []),
      /**
       * `visitBody`, not `contactBody` — the times, not an invitation to get in
       * touch. Under a heading that reads "Where to find us" the times are the
       * answer, which is the same call Cinematic makes.
       */
      ...(features.contact ? [contactBand("Where to find us", copy.visitBody)] : []),
      closingBand("Come and see", copy, "Plan your visit"),
    ];

    return composeHome(blocks, profile, copy, recipe);
  },

  buildPage(path: string, profile: TemplateProfile) {
    const copy = resolveTemplateCopy(profile, { ctaLabel: "Plan your visit" });
    return buildTemplatePage(path, profile, copy, VOICE, recipe);
  },
};
