import { ComponentType } from "react";
import { SectionProps, SectionType } from "@/lib/site/types";
import { NavbarTransparent, NavbarSolid, NavbarMinimal } from "@/components/website/sections/navbar";
import { HeroSplit, HeroCentered, HeroFullscreen, HeroCinematic } from "@/components/website/sections/hero";
import { WelcomeCentered, WelcomeSplit } from "@/components/website/sections/welcome";
import { SermonCards, SermonFeatured, SermonList } from "@/components/website/sections/sermons";
import { EventGrid, EventList, EventCalendar } from "@/components/website/sections/events";
import { AboutImageRight, AboutImageLeft } from "@/components/website/sections/about";
import { MinistryGrid } from "@/components/website/sections/ministries";
import { GivingCentered } from "@/components/website/sections/giving";
import { YouTubeFeatured } from "@/components/website/sections/youtube";
import { PodcastFeatured } from "@/components/website/sections/podcast";
import { ContactStandard } from "@/components/website/sections/contact";
import { CTAFullWidth } from "@/components/website/sections/cta";
import { FooterStandard } from "@/components/website/sections/footer";

/**
 * The ONLY place section components are wired up. The renderer resolves
 * components exclusively through this fixed registry — it never imports a
 * component dynamically from a database value or user input, which would
 * allow arbitrary code execution from untrusted data.
 */
export const sectionRegistry: Record<
  SectionType,
  Record<string, ComponentType<SectionProps>>
> = {
  navbar: {
    transparent: NavbarTransparent,
    solid: NavbarSolid,
    minimal: NavbarMinimal,
  },
  hero: {
    split: HeroSplit,
    centered: HeroCentered,
    fullscreen: HeroFullscreen,
    cinematic: HeroCinematic,
  },
  welcome: {
    centered: WelcomeCentered,
    split: WelcomeSplit,
  },
  sermons: {
    cards: SermonCards,
    featured: SermonFeatured,
    list: SermonList,
  },
  events: {
    grid: EventGrid,
    list: EventList,
    calendar: EventCalendar,
  },
  about: {
    "image-right": AboutImageRight,
    "image-left": AboutImageLeft,
  },
  ministries: {
    grid: MinistryGrid,
  },
  giving: {
    centered: GivingCentered,
  },
  youtube: {
    featured: YouTubeFeatured,
  },
  podcast: {
    featured: PodcastFeatured,
  },
  contact: {
    standard: ContactStandard,
  },
  cta: {
    "full-width": CTAFullWidth,
  },
  footer: {
    standard: FooterStandard,
  },
};

export function variantsFor(type: SectionType): string[] {
  return Object.keys(sectionRegistry[type] ?? {});
}

export function resolveSectionComponent(
  type: string,
  variant: string
): ComponentType<SectionProps> | null {
  const family = sectionRegistry[type as SectionType];
  if (!family) return null;
  return family[variant] ?? null;
}
