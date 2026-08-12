import { BrandConfig } from "@/lib/theme/types";
import { FeatureConfig } from "@/lib/features/types";

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
  seo: SeoConfig;
  socialLinks: Array<{ platform: string; url: string }>;
  youtube?: YoutubeConfig;
  podcast?: PodcastConfig;
  giving?: GivingConfig;
  contact?: ContactInfo;
}
