import { TemplateDefinition } from "./types";

export const minimalChurchTemplate: TemplateDefinition = {
  id: "minimal-church",
  version: 1,
  metadata: {
    name: "Minimal Church",
    description: "Clean, minimal, single-column layout for small congregations",
    style: "minimal",
    suitableFor: ["small", "new", "traditional"],
  },
  sections: [
    { type: "navbar", variant: "minimal" },
    { type: "hero", variant: "fullscreen" },
    { type: "welcome", variant: "centered" },
    { type: "sermons", variant: "list" },
    { type: "events", variant: "list" },
    { type: "about", variant: "image-right" },
    { type: "contact", variant: "standard" },
    { type: "footer", variant: "standard" },
  ],
};
