import type { Site, SocialLink } from "@prisma/client";
import { BrandConfig } from "@/lib/theme/types";
import { isValidFontKey } from "@/lib/theme/fonts";
import { FeatureConfig, defaultFeatures } from "@/lib/features/types";
import { defaultBrandConfig } from "@/lib/validation/brand";
import { coerceSections } from "@/lib/validation/section";
import { safeMediaUrl } from "@/lib/validation/url";
import {
  ContactInfo,
  GivingConfig,
  NavigationItem,
  PodcastConfig,
  SectionInstance,
  SeoConfig,
  SiteConfig,
  YoutubeConfig,
} from "./types";
import {
  parseChurchStory,
  parseImprovements,
  parseDesignFeedback,
  parseMobileFeedback,
  parseAgentLog,
  parseStyleName,
} from "./story";

type SiteWithRelations = Site & { socialLinks?: SocialLink[] };

const HEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

/**
 * Read-path coercion for the `Json` columns.
 *
 * These used to be `as unknown as` casts, which made every read a bet that
 * nothing had ever written a bad shape. `(sectionConfig as SectionInstance[]).map`
 * throws for a non-array, and that throw lands on a published church's homepage.
 * Coercing instead means one malformed field degrades to its default and the
 * site stays up; the write path (`brandConfigSchema`, `sectionConfigSchema`,
 * `navigationConfigSchema`) is where bad input is rejected outright.
 */

function coerceBrand(value: unknown): BrandConfig {
  const raw = isPlainObject(value) ? value : {};
  const colors = isPlainObject(raw.colors) ? raw.colors : {};
  const typography = isPlainObject(raw.typography) ? raw.typography : {};
  const logo = isPlainObject(raw.logo) ? raw.logo : {};
  const favicon = isPlainObject(raw.favicon) ? raw.favicon : {};

  const color = (key: keyof BrandConfig["colors"]) => {
    const candidate = colors[key];
    return typeof candidate === "string" && HEX.test(candidate)
      ? candidate
      : defaultBrandConfig.colors[key];
  };

  const font = (key: "primaryFont" | "secondaryFont") => {
    const candidate = typography[key];
    return typeof candidate === "string" && isValidFontKey(candidate)
      ? candidate
      : defaultBrandConfig.typography[key];
  };

  return {
    colors: {
      primary: color("primary"),
      secondary: color("secondary"),
      background: color("background"),
      foreground: color("foreground"),
      accent: color("accent"),
    },
    typography: { primaryFont: font("primaryFont"), secondaryFont: font("secondaryFont") },
    logo: {
      url: safeMediaUrl(logo.url) ?? "",
      alt: typeof logo.alt === "string" ? logo.alt.slice(0, 160) : "",
    },
    favicon: { url: safeMediaUrl(favicon.url) ?? "" },
    tagline: typeof raw.tagline === "string" ? raw.tagline.slice(0, 160) : "",
  };
}

function coerceFeatures(value: unknown): FeatureConfig {
  const raw = isPlainObject(value) ? value : {};
  const result = { ...defaultFeatures };
  for (const key of Object.keys(defaultFeatures) as Array<keyof FeatureConfig>) {
    if (typeof raw[key] === "boolean") result[key] = raw[key] as boolean;
  }
  return result;
}

function coerceNavigation(value: unknown): NavigationItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isPlainObject)
    .map((item) => ({
      label: typeof item.label === "string" ? item.label.slice(0, 40) : "",
      href: typeof item.href === "string" ? item.href : "",
    }))
    // Navigation only ever points at our own pages, so anything that is not a
    // clean internal path is dropped rather than rendered.
    .filter((item) => item.label !== "" && /^\/[a-z0-9/-]*$/.test(item.href));
}

function coerceSeo(value: unknown): SeoConfig {
  const raw = isPlainObject(value) ? value : {};
  const str = (key: string, max: number) => {
    const candidate = raw[key];
    return typeof candidate === "string" ? candidate.slice(0, max) : undefined;
  };
  return {
    title: str("title", 200) ?? "",
    description: str("description", 400) ?? "",
    ogImage: safeMediaUrl(raw.ogImage),
    canonicalUrl: safeMediaUrl(raw.canonicalUrl),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The single place a raw Prisma `Site` row is turned into the strongly
 * typed `SiteConfig` the renderer, builder, and preview all consume. Keeps
 * `Json` column shapes from leaking into components.
 */
export function toSiteConfig(site: SiteWithRelations): SiteConfig {
  const brand = coerceBrand(site.brandConfig);
  const features = coerceFeatures(site.featureConfig);
  const navigation = coerceNavigation(site.navigationConfig);
  const seo = coerceSeo(site.seoConfig);

  const sections = (coerceSections(site.sectionConfig) as SectionInstance[]).map((section) => {
    // AI-generated sites are held to the cinematic look the crew is briefed
    // for; a "centered" hero or welcome from an older run is upgraded on read.
    if (site.templateId !== "ai-generated") return section;
    if (section.type === "hero" && section.variant === "centered") {
      return { ...section, variant: "cinematic" };
    }
    if (section.type === "welcome" && section.variant === "centered") {
      return { ...section, variant: "split" };
    }
    return section;
  });

  const contact: ContactInfo = {
    email: site.primaryContactEmail ?? undefined,
    phone: site.primaryContactPhone ?? undefined,
  };

  const socialLinks = (site.socialLinks ?? []).map((link) => ({
    platform: link.platform,
    url: link.url,
  }));

  const youtubeSection = sections.find((s) => s.type === "youtube");
  const podcastSection = sections.find((s) => s.type === "podcast");
  const givingSection = sections.find((s) => s.type === "giving");
  const youtubeLink = socialLinks.find((l) => l.platform === "youtube");

  const youtube: YoutubeConfig = {
    channelUrl:
      safeMediaUrl(youtubeSection?.config.channelUrl) ?? safeMediaUrl(youtubeLink?.url),
  };

  const podcast: PodcastConfig = {
    rssUrl: safeMediaUrl(podcastSection?.config.rssUrl),
  };

  const giving: GivingConfig = {
    givingUrl: safeMediaUrl(givingSection?.config.givingUrl),
  };

  return {
    site: {
      id: site.id,
      name: site.name,
      slug: site.slug,
      denomination: site.denomination ?? undefined,
      congregationSize: site.congregationSize ?? undefined,
      status: site.status,
    },
    brand,
    features,
    template: { id: site.templateId, version: site.templateVersion },
    navigation,
    sections,
    seo,
    socialLinks,
    youtube,
    podcast,
    giving,
    contact,
    story: parseChurchStory(site.storyConfig),
    improvements: parseImprovements(site.storyConfig),
    designFeedback: parseDesignFeedback(site.storyConfig),
    mobileFeedback: parseMobileFeedback(site.storyConfig),
    agentLog: parseAgentLog(site.storyConfig),
    styleName: parseStyleName(site.storyConfig),
  };
}
