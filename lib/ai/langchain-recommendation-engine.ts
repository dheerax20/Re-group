import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { allTemplates } from "@/lib/templates/registry";
import {
  RecommendationInput,
  TemplateRecommendation,
  TemplateRecommendationEngine,
} from "./types";

const recommendationSchema = z.object({
  recommendations: z
    .array(
      z.object({
        templateId: z.string(),
        score: z.number().min(0).max(100),
        reasons: z.array(z.string()).min(1).max(4),
      })
    )
    .min(1)
    .max(4),
});

/**
 * AI-ready implementation of TemplateRecommendationEngine built on
 * LangChain (ChatOpenAI + a structured-output runnable). It never touches
 * React/Next.js code — it only ever returns the same
 * TemplateRecommendation[] shape RuleBasedRecommendationEngine returns, so
 * it's a drop-in replacement wherever the interface is used.
 *
 * Requires OPENAI_API_KEY. Callers should use
 * `getTemplateRecommendationEngine()` (see index.ts) rather than
 * constructing this directly, so the app degrades gracefully to the
 * rule-based engine when no API key is configured.
 */
export class AIRecommendationEngine implements TemplateRecommendationEngine {
  private chain: RunnableSequence;

  constructor(apiKey: string, model = "gpt-4o-mini") {
    const llm = new ChatOpenAI({ apiKey, model, temperature: 0.2 });
    const structuredLlm = llm.withStructuredOutput(recommendationSchema, {
      name: "template_recommendations",
    });

    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        "You are a design recommendation engine for a church website builder. " +
          "You choose 1-4 templates from a fixed catalog that best fit a church's " +
          "profile, and explain each pick with short, concrete reasons a church " +
          "admin would understand. You must only choose templateId values from " +
          "the provided catalog — never invent one.",
      ],
      [
        "human",
        "Church profile:\n{profile}\n\nAvailable templates (id, style, suitable-for tags):\n{catalog}\n\n" +
          "Return 1-4 recommendations ranked best first.",
      ],
    ]);

    this.chain = RunnableSequence.from([prompt, structuredLlm]);
  }

  async recommend(input: RecommendationInput): Promise<TemplateRecommendation[]> {
    const catalog = allTemplates
      .map(
        (t) =>
          `- ${t.id}: style=${t.metadata.style}, suitableFor=[${t.metadata.suitableFor.join(", ")}]`
      )
      .join("\n");

    const profile = JSON.stringify(
      {
        churchName: input.churchName,
        denomination: input.denomination,
        congregationSize: input.congregationSize,
        colors: input.brand.colors,
        features: input.features,
      },
      null,
      2
    );

    const result = (await this.chain.invoke({
      profile,
      catalog,
    })) as z.infer<typeof recommendationSchema>;

    const validIds = new Set(allTemplates.map((t) => t.id));

    return result.recommendations
      .filter((r) => validIds.has(r.templateId))
      .slice(0, 4);
  }
}
