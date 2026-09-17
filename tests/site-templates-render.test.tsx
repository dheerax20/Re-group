import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { PageBlocks } from "@/lib/site/blocks/types";
import type { SiteConfig, SiteContent } from "@/lib/site/types";
import { defaultBrandConfig } from "@/lib/validation/brand";
import { defaultFeatures } from "@/lib/features/types";

/**
 * The three templates, taken all the way to markup.
 *
 * `tests/site-templates.test.ts` proves the trees are right. This proves the
 * renderer can actually turn them into a page — a template that emits a
 * perfectly valid node the switch in `block-renderer.tsx` has no case for
 * would pass every tree assertion and then throw on a live church's homepage.
 *
 * Same stubs as `block-renderer-chrome.test.tsx`, for the same reason.
 */
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => createElement("img", props),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const { BlockTree } = await import("@/components/website/blocks/block-renderer");
const { SITE_TEMPLATES } = await import("@/lib/site/templates");

const site = {
  site: { id: "site_render", name: "Hail Mary Community", slug: "hail-mary" },
  brand: defaultBrandConfig,
  features: defaultFeatures,
  navigation: [
    { label: "Home", href: "/" },
    { label: "Sermons", href: "/sermons" },
  ],
  contact: { email: "hello@hailmary.org" },
  giving: { givingUrl: "https://example.org/give" },
  socialLinks: [],
} as unknown as SiteConfig;

const content = { sermons: [], events: [] } as unknown as SiteContent;

const profile = {
  siteId: "site_render",
  churchName: "Hail Mary Community",
  tagline: "A church on the corner of Ashfield and Vine",
  story: { city: "Ashfield", serviceTimes: "Sundays at 9am and 11am." },
  features: { ...defaultFeatures, giving: true, ministries: true },
  brand: defaultBrandConfig,
} as never;

function render(blocks: PageBlocks): string {
  return renderToStaticMarkup(
    createElement(BlockTree, { nodes: blocks, site, content }) as never
  );
}

describe.each(SITE_TEMPLATES.map((t) => [t.name, t] as const))("%s renders", (_name, template) => {
  const html = render(template.buildHome(profile));

  it("puts the headline and the photograph on the page", () => {
    expect(html).toContain("A church on the corner of Ashfield and Vine");
    expect(html).toContain("8qsia8g9sr.ufs.sh");
  });

  /**
   * The fixture has no sermons and no events, which is every church on build
   * day — so this renders each template's real day-one homepage. A gradient
   * block in the position a photograph would occupy is the shape the old empty
   * state took, and this catches it coming back on any of the six without
   * needing to know which band the collection landed on.
   */
  it("shows no gradient slab where a collection has nothing yet", () => {
    expect(html).not.toContain("linear-gradient");
    expect(html).not.toContain("border-dashed");
  });

  it("emits no unstyled interpolated class", () => {
    // Tailwind's scanner reads source text, so a class built at runtime
    // compiles fine and renders unstyled. `undefined` in a class attribute is
    // the shape that failure takes.
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("NaN");
  });

  it.each(["/about", "/contact", "/giving", "/ministries"])("renders %s", (path) => {
    const page = template.buildPage(path, profile);
    expect(page).toBeTruthy();
    const markup = render(page as PageBlocks);
    expect(markup.length).toBeGreaterThan(200);
    expect(markup).not.toContain("undefined");
  });
});
