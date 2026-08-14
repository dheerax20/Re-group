import { getTemplate } from "@/lib/templates/registry";
import { DeterministicSiteGenerator } from "@/lib/ai/deterministic-site-generator";
import { defaultBrandConfig } from "@/lib/validation/brand";
import { SiteConfig } from "./types";

const generator = new DeterministicSiteGenerator();

/**
 * Builds a full, real SiteConfig for a candidate template without
 * persisting anything — used to render true-to-final template previews
 * during onboarding (spec: previews must use the actual submitted brand,
 * never generic screenshots).
 */
export async function buildPreviewSiteConfig(
  site: SiteConfig,
  templateId: string
): Promise<SiteConfig> {
  const template = getTemplate(templateId);
  if (!template) throw new Error(`Unknown template: ${templateId}`);

  const generated = await generator.generateSiteConfig(
    {
      churchName: site.site.name,
      tagline: site.brand.tagline,
      denomination: site.site.denomination,
      congregationSize: site.site.congregationSize,
      brand: site.brand,
      features: site.features,
      templateId,
      story: site.story,
    },
    { enrich: false }
  );

  const preset = template.brandPreset;
  const brand =
    preset && site.brand.colors.primary === defaultBrandConfig.colors.primary
      ? {
          ...site.brand,
          colors: preset.colors,
          typography: preset.typography,
        }
      : site.brand;

  return {
    ...site,
    brand,
    template: { id: template.id, version: template.version },
    sections: generated.sections,
    navigation: generated.navigation,
    seo: generated.seo,
  };
}
