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
 * Bright & Welcoming — the church as an invitation.
 *
 * Shares Cinematic's dark photography and nothing else about how it is held:
 * the frame is inset with rounded corners, the copy sits on its bottom edge and
 * the call to action opposite it, and the navigation stays on the white page
 * above rather than over the picture.
 *
 * Structurally it is the one template that answers a visitor's real first
 * question before it does anything else. Every other template opens with who
 * this church is; this one opens with what turning up actually involves, which
 * is what "built around an invitation rather than an announcement" has to mean
 * if it means anything.
 *
 * Headings are second person throughout, matching the direction's copy voice —
 * "Your first Sunday", not "Service times".
 */
const { recipe, navVariant } = directionFor("bright-welcoming");

const VOICE: PageVoice = {
  about: "Who you'll meet",
  values: "What we care about",
  contact: "Come and say hello",
  giving: "Give",
  ministries: "Find your people",
};

export const brightWelcomingTemplate: SiteTemplate = {
  id: "bright-welcoming",
  name: "Bright & Welcoming",
  version: 1,
  tagline: "A rounded photograph, a warm welcome, and an answer before you ask.",
  navVariant,
  recipe,

  buildHome(profile: TemplateProfile) {
    const copy = resolveTemplateCopy(profile, { ctaLabel: "Plan your visit" });
    const { features } = profile;

    const blocks = [
      band("welcome", [
        heading("welcome-heading", "Who you'll meet"),
        paragraph("welcome-text", copy.aboutBody),
        photoSlot("welcome-photo"),
      ]),
      /**
       * The invitation, high on the page and before any collection. This is the
       * band that makes the direction what it is — a visitor deciding whether
       * to turn up on Sunday should not have to scroll past a sermon archive to
       * find out when and where.
       */
      band("first-visit", [
        heading("first-visit-heading", "Your first Sunday"),
        paragraph("first-visit-text", copy.visitBody),
      ]),
      ...(features.sermons ? [sermonsBand("Listen in")] : []),
      ...(features.events ? [eventsBand("What's coming up")] : []),
      ...(features.ministries ? [ministriesBand("Find your people", copy.ministriesBody)] : []),
      ...(features.giving ? [givingBand("Give", copy.givingBody)] : []),
      ...(features.contact ? [contactBand("Come and say hello", copy.contactBody)] : []),
      closingBand("We'd love to meet you", copy, "Plan your visit"),
    ];

    return composeHome(blocks, profile, copy, recipe);
  },

  buildPage(path: string, profile: TemplateProfile) {
    const copy = resolveTemplateCopy(profile, { ctaLabel: "Plan your visit" });
    return buildTemplatePage(path, profile, copy, VOICE, recipe);
  },
};
