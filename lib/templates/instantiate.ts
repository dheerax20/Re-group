import { TemplateDefinition } from "./types";
import { SectionInstance } from "@/lib/site/types";

/**
 * Turns a template's static composition into concrete, editable section
 * instances for a site. Called once when a template is selected; after
 * that the builder owns the section list (enable/disable/reorder).
 */
export function instantiateTemplateSections(
  template: TemplateDefinition
): SectionInstance[] {
  return template.sections.map((section, index) => ({
    id: `${section.type}-${index}`,
    type: section.type,
    variant: section.variant,
    enabled: true,
    config: section.config ?? {},
  }));
}
