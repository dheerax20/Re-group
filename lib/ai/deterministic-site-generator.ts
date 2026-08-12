import { getTemplate } from "@/lib/templates/registry";
import { instantiateTemplateSections } from "@/lib/templates/instantiate";
import { generateNavigation } from "@/lib/site/navigation";
import {
  GeneratedSiteConfig,
  SiteGenerationInput,
  SiteGenerationProvider,
} from "./types";

/**
 * MVP implementation of SiteGenerationProvider: deterministic, rule-based
 * composition of a template into a full site configuration. No AI call
 * involved. OpenAISiteGenerationProvider (future) implements the same
 * interface to generate copy/section ordering/SEO via an LLM, but must
 * still only return this JSON shape — never source code.
 */
export class DeterministicSiteGenerator implements SiteGenerationProvider {
  async generateSiteConfig(input: SiteGenerationInput): Promise<GeneratedSiteConfig> {
    const template = getTemplate(input.templateId);
    if (!template) {
      throw new Error(`Unknown template: ${input.templateId}`);
    }

    const sections = instantiateTemplateSections(template).map((section) => {
      if (section.type === "hero") {
        return {
          ...section,
          config: {
            title: `Welcome to ${input.churchName}`,
            description: input.tagline || "A place to belong.",
          },
        };
      }
      if (section.type === "cta") {
        return {
          ...section,
          config: {
            title: `Join us this Sunday at ${input.churchName}`,
          },
        };
      }
      return section;
    });

    const navigation = generateNavigation(input.features);

    const seo = {
      title: `${input.churchName}${input.tagline ? ` — ${input.tagline}` : ""}`,
      description:
        input.tagline ||
        `${input.churchName} is a church community. Join us for services, sermons, and events.`,
    };

    return { sections, navigation, seo };
  }
}
