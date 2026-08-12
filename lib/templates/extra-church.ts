import { TemplateDefinition } from "./types";

export const communityWarmTemplate: TemplateDefinition = {
  id: "community-warm",
  version: 1,
  metadata: {
    name: "Community Warm",
    description: "Welcoming, hospitality-first layout for neighborhood churches",
    style: "community",
    suitableFor: ["small", "growing", "contemporary"],
  },
  sections: [
    { type: "navbar", variant: "solid" },
    { type: "hero", variant: "split" },
    { type: "welcome", variant: "split" },
    { type: "events", variant: "grid" },
    { type: "ministries", variant: "grid" },
    { type: "about", variant: "image-right" },
    { type: "sermons", variant: "cards" },
    { type: "cta", variant: "full-width" },
    { type: "contact", variant: "standard" },
    { type: "footer", variant: "standard" },
  ],
};

export const contemporaryBoldTemplate: TemplateDefinition = {
  id: "contemporary-bold",
  version: 1,
  metadata: {
    name: "Contemporary Bold",
    description: "High-contrast media layout for modern worship communities",
    style: "contemporary",
    suitableFor: ["large", "growing", "contemporary"],
  },
  sections: [
    { type: "navbar", variant: "transparent" },
    { type: "hero", variant: "fullscreen" },
    { type: "sermons", variant: "featured" },
    { type: "youtube", variant: "featured" },
    { type: "events", variant: "calendar" },
    { type: "welcome", variant: "centered" },
    { type: "giving", variant: "centered" },
    { type: "cta", variant: "full-width" },
    { type: "footer", variant: "standard" },
  ],
};

export const sacredClassicTemplate: TemplateDefinition = {
  id: "sacred-classic",
  version: 1,
  metadata: {
    name: "Sacred Classic",
    description: "Timeless, reverent composition with editorial storytelling",
    style: "traditional",
    suitableFor: ["traditional", "established", "small"],
  },
  sections: [
    { type: "navbar", variant: "minimal" },
    { type: "hero", variant: "centered" },
    { type: "about", variant: "image-left" },
    { type: "sermons", variant: "list" },
    { type: "welcome", variant: "centered" },
    { type: "events", variant: "list" },
    { type: "contact", variant: "standard" },
    { type: "footer", variant: "standard" },
  ],
};
