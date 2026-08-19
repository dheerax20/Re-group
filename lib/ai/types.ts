import { BrandConfig } from "@/lib/theme/types";
import { FeatureConfig } from "@/lib/features/types";
import { SectionInstance, NavigationItem, SeoConfig } from "@/lib/site/types";
import type { ChurchStory } from "@/lib/site/story";
import type { BlockNode } from "@/lib/site/blocks/types";

export interface RecommendationInput {
  churchName: string;
  denomination?: string;
  congregationSize?: number;
  brand: BrandConfig;
  features: FeatureConfig;
  story?: ChurchStory;
}

export type TemplateRecommendation = {
  templateId: string;
  score: number;
  reasons: string[];
};

/**
 * Both the deterministic and AI-backed recommenders implement this same
 * interface, so the UI never has to know or care which one produced a
 * given recommendation.
 */
export interface TemplateRecommendationEngine {
  recommend(input: RecommendationInput): Promise<TemplateRecommendation[]>;
}

export interface SiteGenerationInput {
  churchName: string;
  tagline?: string;
  denomination?: string;
  congregationSize?: number;
  brand: BrandConfig;
  features: FeatureConfig;
  templateId: string;
  story?: ChurchStory;
}

export interface GeneratedSiteConfig {
  sections: SectionInstance[];
  /** Present only from the AI page-composer path (`assembleGeneratedBlocks`) — the block tree that's actually persisted for that build, instead of `sections`. */
  blocks?: BlockNode[];
  navigation: NavigationItem[];
  seo: SeoConfig;
}

/**
 * AI providers must only ever return this structured JSON shape — never
 * React/Next.js source code. See spec section 18.
 */
export interface SiteGenerationProvider {
  generateSiteConfig(input: SiteGenerationInput): Promise<GeneratedSiteConfig>;
}
