import { notFound } from "next/navigation";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { BlockTree } from "@/components/website/blocks/block-renderer";
import { ART_DIRECTIONS } from "@/lib/ai/agents/catalog";
import type { HeroCopy } from "@/lib/site/blocks/hero";
import { applyDesignPass } from "@/lib/site/blocks/design-pass";
import { defaultNavBlock, defaultFooterBlock } from "@/lib/site/blocks/schema";
import type { PageBlocks } from "@/lib/site/blocks/types";
import { defaultBrandConfig } from "@/lib/validation/brand";
import { SITE_TEMPLATES, type TemplateProfile } from "@/lib/site/templates";
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
 * Off by default, including in development. It renders only fixtures and
 * takes no input, but it is scaffolding and should not answer on a production
 * domain by accident — set `DESIGN_PREVIEW=1` to open it. An env flag rather
 * than a `NODE_ENV` check because the sites being compared against it are
 * deployed, and a visual check that cannot run where the sites are is not a
 * check.
 */
/**
 * Rendered per request, not prerendered.
 *
 * `force-static` baked the `DESIGN_PREVIEW` check in at build time, so setting
 * the variable on a deployed environment did nothing — the page had already
 * decided to 404. The whole point of the env flag is to open this where the
 * sites being compared against it actually live, so the check has to run when
 * someone asks for the page.
 */
export const dynamic = "force-dynamic";

const COPY: HeroCopy = {
  headline: "A church on the corner of Ashfield and Vine",
  subhead: "Two services every Sunday, and coffee on the steps after both.",
  ctaLabel: "Plan your visit",
  ctaHref: "/contact",
};

const CONTENT: SiteContent = { sermons: [], events: [] };

const FIXTURE_FEATURES = {
  sermons: true,
  sermonSearch: false,
  events: true,
  ministries: false,
  giving: true,
  contact: true,
  youtube: false,
  podcast: false,
};

function fixtureSite(navVariant: SiteConfig["navVariant"]): SiteConfig {
  return {
    site: {
      id: "preview",
      name: "Hail Mary Community",
      slug: "preview",
      status: "PUBLISHED",
    },
    brand: defaultBrandConfig as SiteConfig["brand"],
    features: FIXTURE_FEATURES as SiteConfig["features"],
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
  if (process.env.DESIGN_PREVIEW !== "1") notFound();

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

      {/*
        The three pre-built templates, rendered from the same fixture as the
        six AI directions below. A template is a pure function of the church
        profile, so this is the real page a church would get — and the only
        way to check the three read as three decisions rather than one layout
        with three sets of words.
      */}
      {SITE_TEMPLATES.map((template) => {
        const profile: TemplateProfile = {
          siteId: template.id,
          churchName: "Hail Mary Community",
          tagline: COPY.headline,
          story: {
            city: "Ashfield",
            serviceTimes: "Sundays at 9am and 11am.",
            mission:
              "We exist to know God and to make him known on our own street. Everything else follows from that.",
            values: "Hospitality, honesty, and showing up for each other.",
            pastorName: "Rev. Marta Oyelaran",
          },
          features: FIXTURE_FEATURES as TemplateProfile["features"],
          brand: defaultBrandConfig as TemplateProfile["brand"],
        };

        const blocks = template.buildHome(profile);
        const site = { ...fixtureSite(template.navVariant), blocks };

        return (
          <section key={`template-${template.id}`} className="mb-12">
            <header className="mx-auto mb-3 max-w-5xl px-6">
              <h2 className="text-lg font-semibold">
                {template.name}{" "}
                <span className="font-normal text-neutral-500">· template, no AI</span>
              </h2>
              <p className="text-sm text-neutral-600">{template.tagline}</p>
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
