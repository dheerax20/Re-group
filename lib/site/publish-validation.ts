import { AI_GENERATED_TEMPLATE_ID } from "@/lib/ai/agents/schemas";
import { validateFeatureDependencies } from "@/lib/features/validate";
import { sectionTypes, type SiteConfig } from "./types";
import { slugSchema } from "@/lib/validation/slug";

export interface PublishError {
  field: string;
  message: string;
}

export interface PublishValidationResult {
  valid: boolean;
  errors: PublishError[];
}

export function validateSiteForPublish(
  site: SiteConfig
): PublishValidationResult {
  const errors: PublishError[] = [];

  if (!site.site.name || site.site.name.trim().length === 0) {
    errors.push({ field: "site.name", message: "Church name is required" });
  }

  const slugResult = slugSchema.safeParse(site.site.slug);
  if (!slugResult.success) {
    errors.push({
      field: "site.slug",
      message: slugResult.error.issues[0]?.message ?? "Invalid slug",
    });
  }

  if (!site.brand.logo?.url) {
    errors.push({ field: "brand.logo", message: "Logo is required" });
  }
  if (!site.brand.colors?.primary) {
    errors.push({
      field: "brand.colors.primary",
      message: "Primary color is required",
    });
  }
  if (!site.brand.colors?.secondary) {
    errors.push({
      field: "brand.colors.secondary",
      message: "Secondary color is required",
    });
  }
  if (!site.brand.typography?.primaryFont) {
    errors.push({
      field: "brand.typography.primaryFont",
      message: "Primary font is required",
    });
  }

  // Every site is composed by the AI crew now; the stock-template registry
  // (and the "does this template id exist / is its version supported" check
  // that went with it) is gone, so anything else is a stale record.
  if (site.template.id !== AI_GENERATED_TEMPLATE_ID) {
    errors.push({
      field: "template.id",
      message: "This site predates the AI builder. Rebuild it before publishing.",
    });
  }

  const featureErrors = validateFeatureDependencies(site.features);
  for (const err of featureErrors) {
    errors.push({ field: `features.${err.field}`, message: err.message });
  }

  if (!site.navigation || site.navigation.length === 0) {
    errors.push({ field: "navigation", message: "Navigation is invalid" });
  }

  for (const section of site.sections) {
    if (!sectionTypes.includes(section.type)) {
      errors.push({
        field: `sections.${section.id}.type`,
        message: `Unknown section type: ${section.type}`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
