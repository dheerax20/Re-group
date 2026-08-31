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
 * Warm Editorial — magazine logic, told as a story.
 *
 * The recipe splits the hero into an asymmetric two-column frame and holds a
 * portrait beside the text rather than behind it, so this is the template with
 * the most to say: a narrative band, then the church's own values as a second
 * voice, then everything else. It is the one to pick when a church filled in
 * the optional wizard fields.
 */
const { recipe, navVariant } = directionFor("warm-editorial");

const VOICE: PageVoice = {
  about: "The story so far",
  values: "What we hold to",
  contact: "Say hello",
  giving: "Give",
  ministries: "Life together",
};

export const warmEditorialTemplate: SiteTemplate = {
  id: "warm-editorial",
  name: "Warm Editorial",
  version: 1,
  tagline: "Asymmetric columns and a portrait beside the text, read like a feature.",
  navVariant,
  recipe,

  buildHome(profile: TemplateProfile) {
    const copy = resolveTemplateCopy(profile, { ctaLabel: "Visit us" });
    const { features } = profile;

    const blocks = [
      band("welcome", [
        heading("welcome-heading", "The story so far"),
        paragraph("welcome-text", copy.aboutBody),
        photoSlot("welcome-photo"),
      ]),
      // Only when the church actually wrote values down. An empty band with a
      // heading over nothing is the failure this whole module exists to avoid.
      ...(copy.valuesBody
        ? [
            band("values", [
              heading("values-heading", "What we hold to"),
              paragraph("values-text", copy.valuesBody),
            ]),
          ]
        : []),
      ...(features.sermons ? [sermonsBand("From the pulpit")] : []),
      ...(features.events ? [eventsBand("Life together")] : []),
      ...(features.ministries ? [ministriesBand("Get involved", copy.ministriesBody)] : []),
      band("visit", [
        heading("visit-heading", "Your first Sunday"),
        paragraph("visit-text", copy.visitBody),
      ]),
      ...(features.giving ? [givingBand("Give", copy.givingBody)] : []),
      ...(features.contact ? [contactBand("Say hello", copy.contactBody)] : []),
      closingBand("There is a seat for you", copy, "Visit us"),
    ];

    return composeHome(blocks, profile, copy, recipe);
  },

  buildPage(path: string, profile: TemplateProfile) {
    const copy = resolveTemplateCopy(profile, { ctaLabel: "Visit us" });
    return buildTemplatePage(path, profile, copy, VOICE, recipe);
  },
};
