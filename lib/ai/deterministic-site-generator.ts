import { getTemplate } from "@/lib/templates/registry";
import { instantiateTemplateSections } from "@/lib/templates/instantiate";
import { generateNavigation } from "@/lib/site/navigation";
import { composeSectionCopy } from "./section-copy";
import { enrichSectionsWithAi } from "./openai-site-copy";
import {
  GeneratedSiteConfig,
  SiteGenerationInput,
  SiteGenerationProvider,
} from "./types";

/**
 * Composes a template into a full site configuration with church-specific
 * copy. When OPENAI_API_KEY is set, section JSON is enriched by the model.
 */
export class DeterministicSiteGenerator implements SiteGenerationProvider {
  async generateSiteConfig(
    input: SiteGenerationInput,
    options?: { enrich?: boolean }
  ): Promise<GeneratedSiteConfig> {
    const template = getTemplate(input.templateId);
    if (!template) {
      throw new Error(`Unknown template: ${input.templateId}`);
    }

    const composed = composeSectionCopy(input, instantiateTemplateSections(template));
    let sections = composed;
    let seo = {
      title: `${input.churchName}${input.tagline ? ` — ${input.tagline}` : ""}`,
      description:
        input.story?.mission ||
        input.tagline ||
        `${input.churchName} is a church community. Join us for services, sermons, and events.`,
    };

    try {
      if (options?.enrich !== false) {
        const enriched = await enrichSectionsWithAi(input, sections);
        sections = enriched.sections;
        if (enriched.seo) seo = enriched.seo;
      }
    } catch (error) {
      console.error("[DeterministicSiteGenerator] AI copy fallback:", error);
    }

    return {
      sections,
      navigation: generateNavigation(input.features),
      seo,
    };
  }
}
