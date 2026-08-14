import { allTemplates } from "@/lib/templates/registry";
import {
  RecommendationInput,
  TemplateRecommendation,
  TemplateRecommendationEngine,
} from "./types";

const traditionalDenominations = new Set([
  "baptist",
  "methodist",
  "presbyterian",
  "lutheran",
  "catholic",
  "orthodox",
  "anglican",
  "episcopal",
]);

/**
 * Deterministic, no-API-key-required recommender. This is what the MVP
 * ships with; AIRecommendationEngine (lib/ai/langchain-recommendation-engine.ts)
 * implements the exact same interface and can replace/augment this later
 * without touching any call site.
 */
export class RuleBasedRecommendationEngine implements TemplateRecommendationEngine {
  async recommend(input: RecommendationInput): Promise<TemplateRecommendation[]> {
    const scored = allTemplates.map((template) => {
      let score = 50;
      const reasons: string[] = [];
      const denomination = (input.denomination ?? "").toLowerCase();
      const size = input.congregationSize ?? 0;

      const isLarge = size >= 400;
      const isSmall = size > 0 && size < 150;
      const isTraditional = traditionalDenominations.has(denomination);

      if (isLarge && (template.metadata.suitableFor.includes("large") || template.metadata.suitableFor.includes("growing"))) {
        score += 20;
        reasons.push("Fits your larger congregation size");
      }
      if (isSmall && template.metadata.suitableFor.includes("small")) {
        score += 20;
        reasons.push("Right-sized, focused layout for a smaller congregation");
      }
      if (isTraditional && (template.metadata.style === "editorial" || template.metadata.style === "minimal" || template.metadata.style === "traditional")) {
        score += 15;
        reasons.push("Classic style suits a traditional denomination");
      }
      if (!isTraditional && (template.metadata.style === "modern" || template.metadata.style === "contemporary" || template.metadata.style === "community" || template.metadata.style === "cinematic" || template.metadata.style === "luminous")) {
        score += 10;
        reasons.push("Contemporary style matches your church profile");
      }
      if (template.metadata.style === "cinematic") {
        score += 6;
        reasons.push("Cinematic visual system feels like a designed brand site");
      }

      if (input.features.sermons && template.sections.some((s) => s.type === "sermons")) {
        score += 10;
        reasons.push("Strong sermon presentation");
      }
      if (input.features.podcast && template.sections.some((s) => s.type === "podcast")) {
        score += 10;
        reasons.push("Media-heavy layout supports your podcast");
      }
      if (input.features.youtube && template.sections.some((s) => s.type === "youtube")) {
        score += 10;
        reasons.push("Includes a strong media/YouTube section");
      }
      if (input.features.events && template.sections.some((s) => s.type === "events")) {
        score += 8;
        reasons.push("Supports events");
      }
      if (input.features.giving && template.sections.some((s) => s.type === "giving")) {
        score += 5;
        reasons.push("Includes an online giving section");
      }

      reasons.push("Works well with your brand colors");

      return {
        templateId: template.id,
        score,
        reasons: Array.from(new Set(reasons)).slice(0, 4),
      };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, 4);
  }
}
