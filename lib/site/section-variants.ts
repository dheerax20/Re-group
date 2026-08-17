import { SectionType } from "./types";

/**
 * Plain data mirror of the section registry's variant keys. Kept separate
 * from components/website/renderer/section-registry.ts (which imports
 * Server Components) so the builder's variant picker — a Client Component
 * — can list options without ever importing server-only component code.
 */
export const sectionVariantOptions: Record<SectionType, string[]> = {
  navbar: ["transparent", "solid", "minimal"],
  hero: ["split", "centered", "fullscreen", "cinematic"],
  welcome: ["centered", "split"],
  sermons: ["cards", "featured", "list"],
  events: ["grid", "list", "calendar"],
  about: ["image-right", "image-left"],
  ministries: ["grid"],
  giving: ["centered"],
  youtube: ["featured"],
  podcast: ["featured"],
  contact: ["standard"],
  cta: ["full-width"],
  footer: ["standard"],
};

export const sectionTypeLabels: Record<SectionType, string> = {
  navbar: "Navigation Bar",
  hero: "Hero",
  welcome: "Welcome",
  sermons: "Sermons",
  events: "Events",
  about: "About",
  ministries: "Ministries",
  giving: "Giving",
  youtube: "YouTube",
  podcast: "Podcast",
  contact: "Contact",
  cta: "Call to Action",
  footer: "Footer",
};
