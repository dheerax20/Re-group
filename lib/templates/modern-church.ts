import { TemplateDefinition } from "./types";

export const modernChurchTemplate: TemplateDefinition = {
  id: "modern-church",
  version: 1,
  metadata: {
    name: "Modern Church",
    description: "Modern, spacious church website with strong media focus",
    style: "modern",
    suitableFor: ["contemporary", "growing", "large"],
  },
  sections: [
    { type: "navbar", variant: "transparent" },
    { type: "hero", variant: "split" },
    { type: "welcome", variant: "centered" },
    { type: "sermons", variant: "cards" },
    { type: "events", variant: "grid" },
    { type: "youtube", variant: "featured" },
    { type: "about", variant: "image-right" },
    { type: "ministries", variant: "grid" },
    { type: "giving", variant: "centered" },
    { type: "cta", variant: "full-width" },
    { type: "footer", variant: "standard" },
  ],
};
