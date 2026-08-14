import type { Site, SocialLink } from "@prisma/client";
import { BrandConfig } from "@/lib/theme/types";
import { FeatureConfig } from "@/lib/features/types";
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
import { parseChurchStory } from "./story";

type SiteWithRelations = Site & { socialLinks?: SocialLink[] };

/**
 * The single place a raw Prisma `Site` row is turned into the strongly
 * typed `SiteConfig` the renderer, builder, and preview all consume. Keeps
 * `Json` column shapes from leaking into components.
 */
export function toSiteConfig(site: SiteWithRelations): SiteConfig {
  const brand = site.brandConfig as unknown as BrandConfig;
  const features = site.featureConfig as unknown as FeatureConfig;
  const navigation = site.navigationConfig as unknown as NavigationItem[];
  const sections = site.sectionConfig as unknown as SectionInstance[];
  const seo = site.seoConfig as unknown as SeoConfig;

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
      (youtubeSection?.config.channelUrl as string | undefined) ?? youtubeLink?.url,
  };

  const podcast: PodcastConfig = {
    rssUrl: podcastSection?.config.rssUrl as string | undefined,
  };

  const giving: GivingConfig = {
    givingUrl: givingSection?.config.givingUrl as string | undefined,
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
  };
}
