import type { BlockNode, PageBlocks } from "@/lib/site/blocks/types";
import { band, heading, paragraph, photoSlot } from "./bands";
import { composeSecondary } from "./compose";
import type { TemplateCopy } from "./copy";
import type { TemplateProfile } from "./types";
import type { DesignRecipe } from "@/lib/site/blocks/design-pass";

/**
 * The headings that carry a template's voice on its secondary pages.
 *
 * The pages themselves have the same skeleton in all three templates —
 * `/contact` is a heading, a sentence and the church's own details however you
 * design it — so the structure is shared and only the words differ. What makes
 * the three look different is the recipe they are run through, not a different
 * arrangement of the same four blocks.
 */
export type PageVoice = {
  about: string;
  values: string;
  contact: string;
  giving: string;
  ministries: string;
};

/**
 * One of the four editable secondary pages, or `null`.
 *
 * `null` means "this template has nothing to add for that path", which sends
 * the renderer back to `defaultPageBlocks`. `/sermons` and `/events` are
 * hand-written JSX listing pages rather than block trees
 * (`lib/site/pages.ts`), so they are never built here.
 */
export function buildTemplatePage(
  path: string,
  profile: TemplateProfile,
  copy: TemplateCopy,
  voice: PageVoice,
  recipe: DesignRecipe
): PageBlocks | null {
  switch (path) {
    case "/about": {
      const intro: BlockNode[] = [
        heading("about-heading", voice.about, "h1"),
        paragraph("about-text", copy.aboutBody),
        // Empty on purpose: `seedWelcomeImage` fills it with this church's
        // stock photograph, and the church replaces it with their own later.
        photoSlot("about-photo"),
      ];

      const blocks: PageBlocks = [band("about-page", intro)];

      if (copy.valuesBody) {
        blocks.push(
          band("about-values", [
            heading("about-values-heading", voice.values),
            paragraph("about-values-text", copy.valuesBody),
          ])
        );
      }

      blocks.push(
        band("about-visit", [
          heading("about-visit-heading", "Visiting"),
          paragraph("about-visit-text", copy.visitBody),
        ])
      );

      return composeSecondary(blocks, profile, recipe);
    }

    case "/contact":
      return composeSecondary(
        [
          band("contact-page", [
            heading("contact-heading", voice.contact, "h1"),
            paragraph("contact-text", copy.contactBody),
            { id: "contact-info", type: "contactInfo" } as BlockNode,
            { id: "contact-social", type: "socialLinks" } as BlockNode,
          ]),
        ],
        profile,
        recipe
      );

    case "/giving":
      return composeSecondary(
        [
          band("giving-page", [
            heading("giving-heading", voice.giving, "h1"),
            paragraph("giving-text", copy.givingBody),
            { id: "giving-cta", type: "givingCta" } as BlockNode,
          ]),
        ],
        profile,
        recipe
      );

    case "/ministries":
      return composeSecondary(
        [
          band("ministries-page", [
            heading("ministries-heading", voice.ministries, "h1"),
            paragraph("ministries-text", copy.ministriesBody),
            { id: "ministries-body", type: "ministryCollection" } as BlockNode,
          ]),
        ],
        profile,
        recipe
      );

    default:
      return null;
  }
}
