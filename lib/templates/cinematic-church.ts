import { TemplateDefinition } from "./types";

export const emberSanctuaryTemplate: TemplateDefinition = {
  id: "ember-sanctuary",
  version: 1,
  metadata: {
    name: "Ember Sanctuary",
    description: "Cinematic dark canvas with terracotta light — Framer-like atmosphere",
    style: "cinematic",
    suitableFor: ["contemporary", "growing", "large"],
  },
  brandPreset: {
    colors: {
      primary: "#201e1d",
      secondary: "#7a8a5e",
      background: "#f6f1ea",
      foreground: "#1c1917",
      accent: "#c67139",
    },
    typography: {
      primaryFont: "inter",
      secondaryFont: "playfair-display",
    },
  },
  sections: [
    { type: "navbar", variant: "transparent" },
    { type: "hero", variant: "cinematic" },
    { type: "welcome", variant: "split" },
    { type: "sermons", variant: "featured" },
    { type: "events", variant: "grid" },
    { type: "ministries", variant: "grid" },
    { type: "about", variant: "image-left" },
    { type: "cta", variant: "full-width" },
    { type: "footer", variant: "standard" },
  ],
};

export const riverGatheringTemplate: TemplateDefinition = {
  id: "river-gathering",
  version: 1,
  metadata: {
    name: "River Gathering",
    description: "Airy, luminous layout with large type and hospitality-first rhythm",
    style: "luminous",
    suitableFor: ["small", "growing", "contemporary"],
  },
  brandPreset: {
    colors: {
      primary: "#1f4e5a",
      secondary: "#e8c9a0",
      background: "#fbf8f3",
      foreground: "#172326",
      accent: "#c45c26",
    },
    typography: {
      primaryFont: "inter",
      secondaryFont: "playfair-display",
    },
  },
  sections: [
    { type: "navbar", variant: "solid" },
    { type: "hero", variant: "split" },
    { type: "welcome", variant: "centered" },
    { type: "events", variant: "grid" },
    { type: "about", variant: "image-right" },
    { type: "sermons", variant: "cards" },
    { type: "contact", variant: "standard" },
    { type: "cta", variant: "full-width" },
    { type: "footer", variant: "standard" },
  ],
};

export const nightCathedralTemplate: TemplateDefinition = {
  id: "night-cathedral",
  version: 1,
  metadata: {
    name: "Night Cathedral",
    description: "Editorial night worship — fullscreen hero and reverent storytelling",
    style: "cinematic",
    suitableFor: ["traditional", "established", "large"],
  },
  brandPreset: {
    colors: {
      primary: "#16131a",
      secondary: "#8b6b4a",
      background: "#f3eee8",
      foreground: "#1a1614",
      accent: "#c9a15b",
    },
    typography: {
      primaryFont: "inter",
      secondaryFont: "playfair-display",
    },
  },
  sections: [
    { type: "navbar", variant: "minimal" },
    { type: "hero", variant: "cinematic" },
    { type: "about", variant: "image-left" },
    { type: "sermons", variant: "list" },
    { type: "welcome", variant: "split" },
    { type: "events", variant: "list" },
    { type: "giving", variant: "centered" },
    { type: "cta", variant: "full-width" },
    { type: "footer", variant: "standard" },
  ],
};
