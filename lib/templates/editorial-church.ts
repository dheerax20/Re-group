import { TemplateDefinition } from "./types";

export const editorialChurchTemplate: TemplateDefinition = {
  id: "editorial-church",
  version: 1,
  metadata: {
    name: "Editorial Church",
    description: "Warm, editorial layout with serif typography and long-form storytelling",
    style: "editorial",
    suitableFor: ["traditional", "established", "large"],
  },
  sections: [
    { type: "navbar", variant: "solid" },
    { type: "hero", variant: "centered" },
    { type: "about", variant: "image-left" },
    { type: "welcome", variant: "split" },
    { type: "sermons", variant: "featured" },
    { type: "podcast", variant: "featured" },
    { type: "events", variant: "list" },
    { type: "ministries", variant: "grid" },
    { type: "contact", variant: "standard" },
    { type: "cta", variant: "full-width" },
    { type: "footer", variant: "standard" },
  ],
};
