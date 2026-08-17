import { sectionVariantOptions } from "@/lib/site/section-variants";
import { sectionTypes, type SectionType } from "@/lib/site/types";
import type { FeatureConfig } from "@/lib/features/types";

export function variantCatalogForPrompt(): string {
  return sectionTypes
    .map((type) => `${type}: ${sectionVariantOptions[type].join(" | ")}`)
    .join("\n");
}

export function sanitizeVariant(type: SectionType, variant: string): string {
  const options = sectionVariantOptions[type];
  return options.includes(variant) ? variant : options[0];
}

export function layoutFromFeatures(
  features: FeatureConfig,
  hero: "split" | "fullscreen" | "cinematic" = "cinematic",
  navbar: "transparent" | "solid" | "minimal" = "transparent"
): Array<{ type: SectionType; variant: string }> {
  const sections: Array<{ type: SectionType; variant: string }> = [
    { type: "navbar", variant: navbar },
    { type: "hero", variant: hero },
    { type: "welcome", variant: "split" },
  ];

  if (features.sermons) sections.push({ type: "sermons", variant: "cards" });
  if (features.events) sections.push({ type: "events", variant: "grid" });

  sections.push({ type: "about", variant: "image-right" });

  if (features.ministries) sections.push({ type: "ministries", variant: "grid" });
  if (features.giving) sections.push({ type: "giving", variant: "centered" });
  if (features.youtube) sections.push({ type: "youtube", variant: "featured" });
  if (features.podcast) sections.push({ type: "podcast", variant: "featured" });
  if (features.contact) sections.push({ type: "contact", variant: "standard" });

  sections.push({ type: "cta", variant: "full-width" });
  sections.push({ type: "footer", variant: "standard" });

  return sections;
}

export function profileForAgents(input: {
  churchName: string;
  tagline?: string;
  denomination?: string;
  congregationSize?: number;
  features: FeatureConfig;
  story?: {
    city?: string;
    worshipStyle?: string;
    serviceTimes?: string;
    pastorName?: string;
    mission?: string;
    values?: string;
  };
  brand: {
    colors: { primary: string; secondary: string; accent?: string };
    typography: { primaryFont: string; secondaryFont?: string };
  };
}): string {
  return JSON.stringify(
    {
      churchName: input.churchName,
      tagline: input.tagline,
      denomination: input.denomination,
      congregationSize: input.congregationSize,
      city: input.story?.city,
      worshipStyle: input.story?.worshipStyle,
      serviceTimes: input.story?.serviceTimes,
      pastorName: input.story?.pastorName,
      mission: input.story?.mission,
      values: input.story?.values,
      features: input.features,
      brand: input.brand,
    },
    null,
    2
  );
}
