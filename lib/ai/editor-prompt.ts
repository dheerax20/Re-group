import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { sectionTypes, type SectionInstance } from "@/lib/site/types";
import type { DesignFeedback, SiteImprovement } from "@/lib/site/story";
import { buildRoleLlm, resolveGateway } from "@/lib/ai/agents/model-config";

const editorPromptResultSchema = z.object({
  summary: z.string().min(8).max(200),
  sections: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        eyebrow: z.string().max(48),
        title: z.string().max(90),
        description: z.string().max(320),
        variant: z.string().max(40),
        ctaLabel: z.string().max(40),
        ctaHref: z.string().max(80),
      })
    )
    .max(12),
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
    .min(2)
    .max(7),
  designFeedback: z
    .array(
      z.object({
        title: z.string().min(4).max(72),
        detail: z.string().min(12).max(200),
        area: z.enum(["mobile", "typography", "media", "contrast", "layout", "content"]),
      })
    )
    .min(1)
    .max(5),
  mobileFeedback: z
    .array(
      z.object({
        title: z.string().min(4).max(72),
        detail: z.string().min(12).max(200),
        area: z.enum(["mobile", "typography", "media", "contrast", "layout", "content"]),
      })
    )
    .min(1)
    .max(5),
});

export type EditorPromptResult = {
  summary: string;
  sections: SectionInstance[];
  improvements: SiteImprovement[];
  designFeedback: DesignFeedback[];
  mobileFeedback: DesignFeedback[];
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

/**
 * Apply a freeform church/editor prompt to the current homepage sections.
 * Does not generate images — reminds the user to provide photos.
 *
 * This is the one place a prompt turns into a validated section diff, and it
 * has exactly two callers: the editor's one-shot "AI prompt" box
 * (`applyWebsiteAiPrompt` in `lib/site/actions.ts`) and the site chatbot's
 * edit node (`lib/ai/chat/graph.ts`). Both go through the same schema and the
 * same `coerceSections` repair pass at the write site — the chatbot is not a
 * second, less-checked way to touch a site's content.
 */
export async function applyEditorAiPrompt(args: {
  churchName: string;
  prompt: string;
  sections: SectionInstance[];
  features: Record<string, unknown>;
  /**
   * Recent turns of an ongoing conversation, oldest first. Optional — the
   * one-shot editor box has none. Kept short by the caller; this function
   * does not cap it further.
   */
  history?: ChatTurn[];
}): Promise<EditorPromptResult> {
  const gateway = resolveGateway();
  if (!gateway) {
    throw new Error("No AI provider is configured (set OPENAI_API_KEY).");
  }

  const llm = buildRoleLlm(gateway, "editor", 0.45);
  const structured = llm.withStructuredOutput(editorPromptResultSchema, {
    name: "editor_ai_prompt",
  });
  const chain = RunnableSequence.from([
    ChatPromptTemplate.fromMessages([
      [
        "system",
        "You are an in-editor AI for a church website builder. " +
          "Apply the pastor/admin prompt to homepage section copy and variants. " +
          "Only edit section ids that exist in the current site JSON. " +
          "Leave imageUrl alone — never invent photo URLs; tell them to upload photos via improvements. " +
          "Hero variants: cinematic, fullscreen, split, or centered — pick whichever the prompt is " +
          "actually asking for; do not default to cinematic. Navbar: transparent, solid, or minimal " +
          "(transparent only reads well over cinematic/fullscreen/split, never over centered). " +
          "About: image-left or image-right. Welcome: centered or split, whichever fits the request. " +
          "ctaHref should be internal paths like /contact, /about, /events. " +
          "Empty string means leave that field unchanged. " +
          "If a conversation history is included, use it to understand what 'that', 'it', or 'the last " +
          "change' refers to — but only act on the CURRENT prompt's request. " +
          "Always refresh improvements + design/mobile feedback covering photos, content, and mobile.",
      ],
      [
        "human",
        "Church: {churchName}\nFeatures: {features}\n\n{history}User prompt:\n{prompt}\n\n" +
          "Current sections JSON:\n{sections}\n\nAllowed section types: {types}",
      ],
    ]),
    structured,
  ]);

  const historyBlock = args.history?.length
    ? `Recent conversation:\n${args.history
        .map((turn) => `${turn.role === "user" ? "Pastor/admin" : "Assistant"}: ${turn.content}`)
        .join("\n")}\n\n`
    : "";

  const result = (await chain.invoke({
    churchName: args.churchName,
    features: JSON.stringify(args.features),
    history: historyBlock,
    prompt: args.prompt.slice(0, 1200),
    sections: JSON.stringify(
      args.sections.map((s) => ({
        id: s.id,
        type: s.type,
        variant: s.variant,
        enabled: s.enabled,
        config: {
          eyebrow: s.config.eyebrow ?? "",
          title: s.config.title ?? "",
          description: s.config.description ?? "",
          imageUrl: s.config.imageUrl ? "[set]" : "",
          primaryCta: s.config.primaryCta ?? s.config.cta ?? null,
        },
      }))
    ),
    types: sectionTypes.join(", "),
  })) as z.infer<typeof editorPromptResultSchema>;

  const byId = new Map(result.sections.map((row) => [row.id, row]));
  const nextSections = args.sections.map((section) => {
    const patch = byId.get(section.id);
    if (!patch) return section;
    const config = { ...section.config };
    if (patch.eyebrow.trim()) config.eyebrow = patch.eyebrow.trim();
    if (patch.title.trim()) config.title = patch.title.trim();
    if (patch.description.trim()) config.description = patch.description.trim();
    if (patch.ctaLabel.trim() || patch.ctaHref.trim()) {
      if (section.type === "hero") {
        const prev = (config.primaryCta as { label?: string; href?: string } | undefined) ?? {};
        config.primaryCta = {
          label: patch.ctaLabel.trim() || prev.label || "Plan your visit",
          href: patch.ctaHref.trim() || prev.href || "/contact",
        };
      }
      if (section.type === "cta") {
        const prev = (config.cta as { label?: string; href?: string } | undefined) ?? {};
        config.cta = {
          label: patch.ctaLabel.trim() || prev.label || "Plan your visit",
          href: patch.ctaHref.trim() || prev.href || "/contact",
        };
      }
    }
    const variant = patch.variant.trim() || section.variant;
    return { ...section, variant, config };
  });

  return {
    summary: result.summary,
    sections: nextSections,
    improvements: result.improvements,
    designFeedback: result.designFeedback,
    mobileFeedback: result.mobileFeedback,
  };
}
