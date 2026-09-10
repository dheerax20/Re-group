import { BrandConfig } from "@/lib/theme/types";
import { FeatureConfig } from "@/lib/features/types";
import type { ChurchStory } from "./story";
import type { BlockNode } from "./blocks/types";

export const sectionTypes = [
  "navbar",
  "hero",
  "welcome",
  "sermons",
  "events",
  "about",
  "ministries",
  "giving",
  "youtube",
  "podcast",
  "contact",
  "cta",
  "footer",
] as const;

export type SectionType = (typeof sectionTypes)[number];

export interface SectionInstance {
  id: string;
  type: SectionType;
  variant: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface NavigationItem {
  label: string;
  href: string;
}

export interface SeoConfig {
  title: string;
  description: string;
  ogImage?: string;
  canonicalUrl?: string;
}

export interface YoutubeConfig {
  channelUrl?: string;
}

export interface PodcastConfig {
  rssUrl?: string;
}

export interface GivingConfig {
  givingUrl?: string;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  address?: string;
}

export interface SermonSummary {
  id: string;
  title: string;
  slug: string;
  speaker?: string | null;
  series?: string | null;
  date: string;
  thumbnailUrl?: string | null;
  description?: string | null;
}

export interface EventSummary {
  id: string;
  title: string;
  slug: string;
  startAt: string;
  location?: string | null;
  imageUrl?: string | null;
  description?: string | null;
}

export interface SiteContent {
  sermons: SermonSummary[];
  events: EventSummary[];
}

export interface SectionProps {
  site: SiteConfig;
  config: Record<string, unknown>;
  content: SiteContent;
}

/** The three navbar treatments a design direction may choose. */
export type NavVariant = "transparent" | "solid" | "minimal";

export interface SiteConfig {
  site: {
    id: string;
    name: string;
    slug: string;
    denomination?: string;
    congregationSize?: number;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  };
  brand: BrandConfig;
  features: FeatureConfig;
  template: {
    id: string;
    version: number;
  };
  navigation: NavigationItem[];
  sections: SectionInstance[];
  /**
   * The generic AI-generated page tree (`lib/site/blocks/types.ts`) that the
   * public renderer (`components/website/blocks/block-renderer.tsx`) walks.
   * `sections` above stays for the builder's existing per-section editing UI
   * (out of scope to rework alongside this) — `blocks` is what a published
   * page actually renders from, whether it came from a fresh AI build or was
   * synthesized from old `sections` data via `legacySectionsToBlocks`.
   */
  blocks: BlockNode[];
  /**
   * Every OTHER editable page's block tree, keyed by path (`"/about"`, ...).
   *
   * The homepage is `blocks` above, not an entry here — read both through
   * `getPageBlocks` (`lib/site/blocks/resolve-page.ts`) rather than reaching
   * into either directly. A path missing from this map has simply never been
   * edited and falls back to `defaultPageBlocks`.
   */
  pages: Record<string, BlockNode[]>;
  seo: SeoConfig;
  socialLinks: Array<{ platform: string; url: string }>;
  youtube?: YoutubeConfig;
  podcast?: PodcastConfig;
  giving?: GivingConfig;
  contact?: ContactInfo;
  story?: ChurchStory;
  improvements?: import("@/lib/site/story").SiteImprovement[];
  designFeedback?: import("@/lib/site/story").DesignFeedback[];
  mobileFeedback?: import("@/lib/site/story").DesignFeedback[];
  agentLog?: Array<{ agent: string; role: string; summary: string }>;
  styleName?: string;
  /** How the navbar renders — see `components/website/blocks/site-header.tsx`. */
  navVariant?: NavVariant;
  /**
   * The stock photograph the current design put in the hero.
   *
   * Read so the design picker can offer a DIFFERENT one for every other
   * template — the same `avoid` the apply path passes, so each card shows the
   * picture that template would actually produce.
   */
  heroImageUrl?: string;
}
