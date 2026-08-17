import { RuleBasedRecommendationEngine } from "./rule-based-recommendation-engine";
import {
  RecommendationInput,
  TemplateRecommendation,
  TemplateRecommendationEngine,
} from "./types";

export * from "./types";
export { RuleBasedRecommendationEngine } from "./rule-based-recommendation-engine";
export { DeterministicSiteGenerator } from "./deterministic-site-generator";
export { ChurchWebsiteCrew } from "./agents/crew";
export { getChurchWebsiteCrew, buildChurchWebsite } from "./multi-agent-site-builder";

const ruleBasedEngine = new RuleBasedRecommendationEngine();

/**
 * The MVP works fully without any AI API key: this always resolves to a
 * usable TemplateRecommendationEngine, using the LangChain-backed engine
 * opportunistically when OPENAI_API_KEY is set and falling back to the
 * deterministic rule-based engine on missing keys or provider errors.
 */
class FallbackRecommendationEngine implements TemplateRecommendationEngine {
  async recommend(input: RecommendationInput): Promise<TemplateRecommendation[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return ruleBasedEngine.recommend(input);
    }

    try {
      const { AIRecommendationEngine } = await import(
        "./langchain-recommendation-engine"
      );
      const aiEngine = new AIRecommendationEngine(apiKey);
      const result = await aiEngine.recommend(input);
      if (result.length === 0) {
        return ruleBasedEngine.recommend(input);
      }
      return result;
    } catch (error) {
      console.error("[AIRecommendationEngine] falling back to rule-based:", error);
      return ruleBasedEngine.recommend(input);
    }
  }
}

const fallbackEngine = new FallbackRecommendationEngine();

export function getTemplateRecommendationEngine(): TemplateRecommendationEngine {
  return fallbackEngine;
}
