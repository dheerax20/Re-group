import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import type { SectionInstance } from "@/lib/site/types";
import type { SiteGenerationInput } from "./types";

const copySchema = z.object({
  seoTitle: z.string().min(8).max(80),
  seoDescription: z.string().min(40).max(180),
  sections: z
    .array(
      z.object({
        type: z.string(),
        eyebrow: z.string().max(48).optional(),
        title: z.string().max(90).optional(),
        description: z.string().max(320).optional(),
      })
    )
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

export async function enrichSectionsWithAi(
  input: SiteGenerationInput,
  sections: SectionInstance[]
): Promise<{ sections: SectionInstance[]; seo?: { title: string; description: string } }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { sections };

  const llm = new ChatOpenAI({ apiKey, model: "gpt-4o-mini", temperature: 0.55 });
  const structured = llm.withStructuredOutput(copySchema, { name: "church_site_copy" });
  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "You write cinematic, specific website copy for church sites. " +
        "Avoid cliches like 'come as you are' unless you add a concrete local detail. " +
        "Never invent addresses, phone numbers, or miracle claims. " +
        "Return JSON only for the provided section types.",
    ],
    [
      "human",
      "Church JSON:\n{profile}\n\nSection types to write: {types}\n\nWrite distinct copy for each type.",
    ],
  ]);
  const chain = RunnableSequence.from([prompt, structured]);

  const types = Array.from(new Set(sections.map((s) => s.type))).join(", ");
  const result = (await chain.invoke({
    profile: JSON.stringify({
      churchName: input.churchName,
      tagline: input.tagline,
      denomination: input.denomination,
      congregationSize: input.congregationSize,
      story: input.story,
    }),
    types,
  })) as z.infer<typeof copySchema>;

  const byType = new Map(result.sections.map((s) => [s.type, s]));

  const next = sections.map((section) => {
    const overlay = byType.get(section.type);
    const config = { ...section.config };
    if (overlay?.eyebrow) config.eyebrow = overlay.eyebrow;
    if (overlay?.title) config.title = overlay.title;
    if (overlay?.description) config.description = overlay.description;
    if (section.type === "hero") {
      config.stats = result.stats;
      config.primaryCta = { label: "Plan your visit", href: "/contact" };
    }
    if (section.type === "ministries") {
      config.items = result.ministries;
    }
    return { ...section, config };
  });

  return {
    sections: next,
    seo: { title: result.seoTitle, description: result.seoDescription },
  };
}
