import { notFound } from "next/navigation";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { BlockTree } from "@/components/website/blocks/block-renderer";
import { ART_DIRECTIONS } from "@/lib/ai/agents/catalog";
import type { HeroCopy } from "@/lib/site/blocks/hero";
import { applyDesignPass } from "@/lib/site/blocks/design-pass";
import { defaultNavBlock, defaultFooterBlock } from "@/lib/site/blocks/schema";
import type { PageBlocks } from "@/lib/site/blocks/types";
import { defaultBrandConfig } from "@/lib/validation/brand";
import type { SiteConfig, SiteContent } from "@/lib/site/types";

/**
 * Every hero archetype and navbar variant, from hand-written fixtures.
 *
 * A real build takes ~90 seconds through a provider and needs a database, so
 * debugging a renderer through one is both slow and expensive. Every layout
 * decision in the hero and the navbar is a pure function of the design recipe,
 * which means all six can be rendered from a fixture with no model, no
 * network and no site row — and compared side by side, which is the only way
 * to see whether six directions actually read as six decisions.
 *
 * Dev-only. It exposes no data and takes no input, but it is scaffolding and
 * has no business answering on a production domain.
 */
export const dynamic = "force-static";

const COPY: HeroCopy = {
  headline: "A church on the corner of Ashfield and Vine",
  subhead: "Two services every Sunday, and coffee on the steps after both.",
  ctaLabel: "Plan your visit",
  ctaHref: "/contact",
};

const CONTENT: SiteContent = { sermons: [], events: [] };

function fixtureSite(navVariant: SiteConfig["navVariant"]): SiteConfig {
  return {
    site: {
      id: "preview",
      name: "Hail Mary Community",
      slug: "preview",
      status: "PUBLISHED",
    },
    brand: defaultBrandConfig as SiteConfig["brand"],
    features: {
      sermons: true,
      events: true,
      ministries: false,
      giving: true,
      contact: true,
      youtube: false,
      podcast: false,
    } as SiteConfig["features"],
    template: { id: "ai-generated", version: 1 },
    navigation: [
      { label: "Home", href: "/" },
      { label: "About", href: "/about" },
      { label: "Sermons", href: "/sermons" },
      { label: "Events", href: "/events" },
      { label: "Give", href: "/giving" },
      { label: "Contact", href: "/contact" },
    ],
    sections: [],
    blocks: [],
    navVariant,
  } as unknown as SiteConfig;
}

/** What a composer reply looks like once the hero has been taken out of its hands. */
function composedBody(): PageBlocks {
  return [
    defaultNavBlock(),
    {
      id: "welcome",
      type: "section",
      children: [
        { id: "welcome-heading", type: "heading", scale: "h2", text: "Who gathers here" },
        {
          id: "welcome-text",
          type: "text",
          text: "Families from the three streets around us, students from the college up the hill, and whoever wanders in on a Sunday morning looking for somewhere to sit.",
        },
        { id: "welcome-photo", type: "image" },
      ],
    },
    {
      id: "sermons",
      type: "section",
      children: [
        { id: "sermons-heading", type: "heading", scale: "h2", text: "Recent sermons" },
        { id: "sermons-body", type: "sermonCollection" },
      ],
    },
    {
      id: "cta",
      type: "section",
      children: [
        { id: "cta-heading", type: "heading", scale: "h2", text: "Come this Sunday" },
        { id: "cta-button", type: "button", label: "Find a service time", href: "/contact" },
      ],
    },
    defaultFooterBlock(),
  ] as unknown as PageBlocks;
}

export default function DesignPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="bg-neutral-100 py-10">
      <div className="mx-auto mb-8 max-w-5xl px-6">
        <h1 className="text-2xl font-semibold">Hero &amp; navbar preview</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600">
          Six design directions, one church profile. Each frame below is a real render of the
          published block tree — the same code path a live site takes. Resize the window to check
          390px and 1440px; the frames are full-bleed, so the viewport is the breakpoint.
        </p>
      </div>

      {ART_DIRECTIONS.map((direction) => {
        const blocks = applyDesignPass(
          composedBody(),
          {
            features: { sermons: true, giving: true, contact: true },
            churchName: "Hail Mary Community",
            hero: COPY,
            siteId: direction.id,
          },
          direction.recipe
        );
        const site = { ...fixtureSite(direction.navbar), blocks };

        return (
          <section key={direction.id} className="mb-12">
            <header className="mx-auto mb-3 max-w-5xl px-6">
              <h2 className="text-lg font-semibold">{direction.name}</h2>
              <p className="text-sm text-neutral-600">
                hero: {direction.recipe.hero.archetype} · nav: {direction.navbar} · sermons:{" "}
                {direction.recipe.sermons} · eyebrows: {direction.recipe.eyebrows}
              </p>
            </header>
            <div className="overflow-hidden border-y border-neutral-300 bg-white">
              <ThemeProvider brand={site.brand}>
                <div className="relative flex flex-col">
                  <BlockTree nodes={blocks} site={site} content={CONTENT} />
                </div>
              </ThemeProvider>
            </div>
          </section>
        );
      })}
    </main>
  );
}
