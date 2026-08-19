import { z } from "zod";
import { sectionTypes } from "@/lib/site/types";
import { ensureBlockIds, pageBlocksSchema, repairBlocks } from "@/lib/site/blocks/schema";
import type { BlockNode } from "@/lib/site/blocks/types";

export const AI_GENERATED_TEMPLATE_ID = "ai-generated";
export const AI_GENERATED_TEMPLATE_VERSION = 1;

/**
 * No `styleName`/`heroTreatment`/`navbarTreatment` here — those are decided
 * once, deterministically, by `pickArtDirection()` before this agent ever
 * runs (see `lib/ai/agents/catalog.ts`). Asking the model to also state them
 * meant a validated, schema-correct answer could still just restate whatever
 * it was biased toward, which is how "prefer cinematic" became "always
 * cinematic." This agent's real, remaining job is describing how the fixed
 * direction should read for THIS specific church.
 */
export const themeBriefSchema = z.object({
  visualLanguage: z.string().min(12).max(280),
  mobileNotes: z.string().min(12).max(240),
  gridNotes: z.string().min(12).max(240),
});

/**
 * Structural traits, independent of `variant`. `variant` picks a component
 * shape (locked per direction for the six types below — see `catalog.ts`);
 * traits vary how that same component renders — alignment, density, a
 * decorative accent, and image treatment — so two churches on the same
 * variant don't render pixel-identical. Only meaningful for
 * hero/welcome/about/sermons/events/cta; harmless no-op on any other type.
 */
export const layoutTraitsSchema = z.object({
  align: z.enum(["left", "center"]).optional(),
  density: z.enum(["compact", "spacious"]).optional(),
  accent: z.enum(["none", "line", "bordered", "numbered"]).optional(),
  mediaTreatment: z.enum(["rounded", "square", "framed"]).optional(),
});

export const layoutPlanSchema = z.object({
  rationale: z.string().min(12).max(280),
  sections: z
    .array(
      z.object({
        type: z.enum(sectionTypes),
        variant: z.string().min(1).max(40),
        traits: layoutTraitsSchema.optional(),
      })
    )
    .min(6)
    .max(12),
});

export const copyDeckSchema = z.object({
  seoTitle: z.string().min(8).max(80),
  seoDescription: z.string().min(40).max(180),
  sections: z
    .array(
      z.object({
        type: z.enum(sectionTypes),
        eyebrow: z.string().max(48),
        title: z.string().max(90),
        description: z.string().max(320),
        ctaLabel: z.string().max(32),
        ctaHref: z.string().max(80),
      })
    )
    .min(1)
    .max(12),
  ministries: z
    .array(
      z.object({
        name: z.string().max(40),
        description: z.string().max(140),
      })
    )
    .min(3)
    .max(4),
  stats: z
    .array(
      z.object({
        label: z.string().max(20),
        value: z.string().max(32),
      })
    )
    .min(2)
    .max(3),
});

/**
 * The page composer's output: a full homepage as a generic block tree
 * (`lib/site/blocks/schema.ts`'s `pageBlocksSchema`) instead of picking
 * among fixed section variants — this is what makes the layout itself
 * AI-generated rather than AI-selected. `blocks` MUST include one top-level
 * `section` block with `id: "nav"` and one with `id: "footer"` (the public
 * layout looks for those reserved ids); `assemble.ts` injects a deterministic
 * fallback for either if the model omits them, so a malformed nav/footer
 * never breaks the page.
 */
export const pageComposerSchema = z.object({
  rationale: z.string().min(12).max(280),
  seoTitle: z.string().min(8).max(80),
  seoDescription: z.string().min(40).max(180),
  blocks: pageBlocksSchema,
});

/** Trims to a max length, tolerating a missing or non-string value. */
function looseText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * How the composer's reply is actually read back.
 *
 * `pageComposerSchema` above describes what we ASK for -- it is what gets
 * converted to the JSON Schema OpenAI receives, and every bound in it is a
 * real instruction to the model.
 *
 * It is the wrong thing to validate the reply with. The block tree is a
 * recursive union, which OpenAI's strict structured-output mode rejects
 * outright, so the composer necessarily runs non-strict -- where `required`
 * and `minLength` are guidance, not guarantees. Parsing the reply against the
 * strict schema meant one absent `id`, or a `rationale` the model simply did
 * not write, threw and failed the whole build ("Invalid input: expected
 * string, received undefined"), discarding a perfectly good homepage over a
 * field nobody renders.
 *
 * So the reply is repaired instead: missing prose degrades to "" and callers
 * substitute their own fallback, ids are minted by `ensureBlockIds`, and
 * malformed blocks are pruned individually by `repairBlocks`. The one thing
 * NOT tolerated is an empty page -- `assembleGeneratedBlocks` throws on that,
 * so a build that produced nothing usable fails loudly rather than
 * publishing a blank site.
 */
export const pageComposerResponseSchema = z.unknown().transform((raw): {
  rationale: string;
  seoTitle: string;
  seoDescription: string;
  blocks: BlockNode[];
} => {
  const reply = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    rationale: looseText(reply.rationale, 280),
    seoTitle: looseText(reply.seoTitle, 80),
    seoDescription: looseText(reply.seoDescription, 180),
    blocks: repairBlocks(ensureBlockIds(reply.blocks)),
  };
});

export const designFeedbackSchema = z.object({
  title: z.string().min(4).max(72),
  detail: z.string().min(12).max(200),
  area: z.enum(["mobile", "typography", "media", "contrast", "layout", "content"]),
});

export const qaReportSchema = z.object({
  approved: z.boolean(),
  issues: z.array(z.string().max(160)).max(8),
  variantFixes: z
    .array(
      z.object({
        type: z.enum(sectionTypes),
        variant: z.string().min(1).max(40),
      })
    )
    .max(8),
  mobileFeedback: z.array(designFeedbackSchema).min(2).max(5),
  designFeedback: z.array(designFeedbackSchema).min(2).max(5),
});

export const producerBriefSchema = z.object({
  churchArchetype: z.string().min(4).max(80),
  designGoal: z.string().min(12).max(240),
  mustInclude: z.array(z.string().max(80)).min(2).max(6),
});

/**
 * Producer brief + theme brief in ONE response.
 *
 * These used to be two sequential agents, and the second one's entire input
 * was the first one's output — a full extra network round trip to OpenAI for
 * information the model was going to reason through in one pass anyway. On a
 * six-call crew that round trip is a meaningful slice of the minute-plus a
 * church waits, so the two are merged: same fields, same downstream
 * consumers, one call. `runProducer`/`runThemeDirector` still exist and still
 * work if you want the two-call shape back.
 */
export const creativeBriefSchema = producerBriefSchema.extend(themeBriefSchema.shape);

export const mediaPlanSchema = z.object({
  improvements: z
    .array(
      z.object({
        title: z.string().min(4).max(72),
        detail: z.string().min(12).max(180),
        action: z.enum([
          "upload_hero_photo",
          "add_welcome_video",
          "connect_youtube",
          "add_event_photos",
          "upload_logo",
          "add_sermon_video",
          "fix_mobile_hero",
          "fix_mobile_nav",
          "tighten_mobile_type",
        ]),
      })
    )
    .min(3)
    .max(7),
});

export type ThemeBrief = z.infer<typeof themeBriefSchema>;
export type LayoutTraits = z.infer<typeof layoutTraitsSchema>;
export type LayoutPlan = z.infer<typeof layoutPlanSchema>;
export type PageComposerOutput = z.infer<typeof pageComposerResponseSchema>;
export type CopyDeck = z.infer<typeof copyDeckSchema>;
export type QaReport = z.infer<typeof qaReportSchema>;
export type ProducerBrief = z.infer<typeof producerBriefSchema>;
export type CreativeBrief = z.infer<typeof creativeBriefSchema>;
export type MediaPlan = z.infer<typeof mediaPlanSchema>;
export type SiteImprovement = MediaPlan["improvements"][number];
export type DesignFeedback = z.infer<typeof designFeedbackSchema>;

export type AgentLogEntry = {
  agent: string;
  role: string;
  summary: string;
};
