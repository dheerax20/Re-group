import { ChurchWebsiteCrew } from "./agents/crew";
import { AI_GENERATED_TEMPLATE_ID } from "./agents/schemas";
import type { SiteGenerationInput } from "./types";

const crew = new ChurchWebsiteCrew();

export function getChurchWebsiteCrew() {
  return crew;
}

export async function buildChurchWebsite(input: SiteGenerationInput) {
  return crew.build({ ...input, templateId: AI_GENERATED_TEMPLATE_ID });
}
