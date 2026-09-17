import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { PageBlocks } from "@/lib/site/blocks/types";
import type { SiteConfig, SiteContent } from "@/lib/site/types";
import { paddingClass } from "@/components/website/blocks/tokens";

/**
 * The header defects in this repo were RENDERING defects, not data defects:
 * the nav band's data was fine and the markup it produced was a 160px-tall
 * two-column grid. `tests/design-pass.test.ts` can only assert the tree, so
 * the classes the tree turns into are pinned here.
 *
 * `next/link` and `next/image` are stubbed to plain elements — this is a test
 * of the block renderer's own class decisions, and the Next components bring a
 * router and an image optimiser that have nothing to do with them.
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

const site = {
  site: { name: "Hail Mary Community" },
  brand: { logo: { url: "", alt: "" } },
  navigation: [
    { label: "Home", href: "/" },
    { label: "Sermons", href: "/sermons" },
    { label: "Events", href: "/events" },
  ],
  contact: {},
  socialLinks: [],
} as unknown as SiteConfig;

const content = { sermons: [], events: [] } as unknown as SiteContent;

function render(blocks: PageBlocks): string {
  return renderToStaticMarkup(
    createElement(BlockTree, { nodes: blocks, site, content }) as never
  );
}

/** The `<section>` opening tag for a band, so assertions can't match a child's classes. */
function sectionTag(html: string, index = 0): string {
  const tags = html.match(/<section[^>]*>/g) ?? [];
  if (!tags[index]) throw new Error(`no <section> at index ${index} in:\n${html}`);
  return tags[index];
}

const navBand: PageBlocks = [{ id: "nav", type: "section", children: [] }];

function withNavVariant(variant: "transparent" | "solid" | "minimal"): string {
  return renderToStaticMarkup(
    createElement(BlockTree, {
      nodes: navBand,
      site: { ...site, navVariant: variant },
      content,
    }) as never
  );
}

/** The `<header>` opening tag, so assertions cannot match a descendant. */
function headerTag(html: string, index = 0): string {
  const tags = html.match(/<header[^>]*>/g) ?? [];
  if (!tags[index]) throw new Error(`no <header> at index ${index} in:\n${html}`);
  return tags[index];
}

describe("the nav bar", () => {
  /**
   * The reported screenshot: `padding: "lg"` is `py-20`, so a 32px logo sat in
   * 160px of vertical space. The bar's height is now fixed in code and no band
   * token can reach it — which is also what makes the `transparent` variant
   * possible, since the hero has to be laid out against a known number.
   */
  it("is a fixed-height bar, whatever the stored band says", () => {
    const withPadding = [
      { ...navBand[0], style: { padding: "2xl" } },
    ] as unknown as PageBlocks;
    const html = render(withPadding);

    expect(headerTag(html)).toBeTruthy();
    expect(html).toContain("h-20");
    expect(html).toContain("lg:h-24");
    expect(html).not.toMatch(/\bpy-(10|16|20|28|36)\b/);
  });

  /**
   * The other half of the screenshot. As an equal-column grid the links began
   * at the container's midpoint and left-packed, stranding ~400px to their
   * right.
   */
  it("pushes the logo and links to opposite ends", () => {
    const html = render(navBand);

    expect(html).toContain("justify-between");
    expect(html).not.toContain("sm:grid-cols-2");
    expect(html).not.toContain("flex flex-col items-start");
  });

  it("sits at the shared page gutter, with no container of its own", () => {
    const html = render(navBand);
    expect(html).toContain("px-6 lg:px-14");
    // Full-bleed: the bar is not centred in a max-width measure.
    expect(headerTag(html)).not.toContain("max-w-");
  });

  it("is a landmark, with a labelled nav inside it", () => {
    const html = render(navBand);
    expect(html).toContain("<header");
    expect(html).toContain('aria-label="Primary"');
  });

  it("ignores the band's children — the header owns its own shape", () => {
    const stuffed = [
      {
        id: "nav",
        type: "section",
        children: [{ id: "nav-junk", type: "heading", text: "Should not render" }],
      },
    ] as unknown as PageBlocks;

    expect(render(stuffed)).not.toContain("Should not render");
  });

  describe("variants", () => {
    it("takes the overlay variant out of flow so the hero runs under it", () => {
      const tag = headerTag(withNavVariant("transparent"));
      expect(tag).toContain("absolute");
      expect(tag).not.toContain("sticky");
      // No backdrop over a photograph, and no rule drawn across it.
      expect(tag).not.toContain("backdrop-blur");
      expect(tag).not.toContain("border-site-muted");
    });

    it("pins the solid variant with a blurred backdrop", () => {
      const tag = headerTag(withNavVariant("solid"));
      expect(tag).toContain("sticky");
      expect(tag).toContain("backdrop-blur");
    });

    it("pins the minimal variant with no backdrop at all", () => {
      const tag = headerTag(withNavVariant("minimal"));
      expect(tag).toContain("sticky");
      expect(tag).not.toContain("backdrop-blur");
    });

    /**
     * An overlay hero starts at the top of the viewport; every other variant
     * would otherwise begin its first band behind the fixed mobile bar.
     */
    it("reserves mobile space for every variant but the overlay", () => {
      expect(withNavVariant("transparent")).not.toContain('class="h-20 sm:hidden"');
      expect(withNavVariant("solid")).toContain('class="h-20 sm:hidden"');
    });
  });
});

describe("the mobile drawer", () => {
  /**
   * The panel is a Radix Dialog rendered through a portal, so it is simply
   * absent from the markup while closed — which is the point: the focus trap,
   * the Escape handler, the click-outside, the scroll lock and the animation
   * are Radix's now, not four hand-written `useEffect`s. What is asserted here
   * is the part that is still ours: the trigger, and the absence of the
   * implementation it replaced. The open panel is a browser check.
   */
  it("opens a dialog rather than a hand-rolled panel", () => {
    const html = render(navBand);

    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('data-slot="sheet-trigger"');
  });

  it("shows a hamburger while closed", () => {
    expect(render(navBand)).toContain("lucide-menu");
  });

  it("gives the trigger a real 44px tap target", () => {
    expect(render(navBand)).toContain("h-11 w-11");
  });

  /**
   * The grid-rows drawer, its magic-number-free animation and its floating
   * `w-48` predecessor are all gone. If any of these come back it means
   * something re-implemented what the Sheet already does.
   */
  it("leaves nothing of the implementations it replaced", () => {
    const html = render(navBand);

    expect(html).not.toContain("grid-rows-[0fr]");
    expect(html).not.toContain("transition-[grid-template-rows]");
    expect(html).not.toContain("w-48");
  });

  it("keeps the bar fixed under every variant, so the trigger cannot scroll away", () => {
    for (const variant of ["transparent", "solid", "minimal"] as const) {
      const html = withNavVariant(variant);
      expect(html, variant).toContain("fixed inset-x-0 top-0 z-30 sm:hidden");
    }
  });
});

describe("content bands are unaffected", () => {
  const band: PageBlocks = [
    {
      id: "hero",
      type: "section",
      style: { padding: "2xl", align: "center", background: "accent" },
      children: [{ id: "hero-heading", type: "heading", scale: "display", text: "Sunday at 10" }],
    },
  ];

  it("keeps its padding, alignment and background", () => {
    const html = render(band);
    const tag = sectionTag(html);

    // Read off the token, not spelled out. The padding RAMP is tuned
    // periodically; what this test is about is that the band kept the token it
    // was given, which a literal class turns into a false failure every time
    // the scale moves.
    expect(tag).toContain(paddingClass["2xl"]);
    expect(tag).toContain("bg-site-accent/10");
    expect(html).toContain("items-center");
  });

  it("still renders a display heading as an h1 with a balanced measure", () => {
    const html = render(band);
    expect(html).toMatch(/<h1[^>]*>Sunday at 10<\/h1>/);
    expect(html).toContain("text-balance");
  });

  it("renders a columns row as a grid", () => {
    const row: PageBlocks = [
      {
        id: "band",
        type: "section",
        children: [
          {
            id: "row",
            type: "row",
            columns: 3,
            children: [
              { id: "a", type: "text", text: "one" },
              { id: "b", type: "text", text: "two" },
              { id: "c", type: "text", text: "three" },
            ],
          },
        ],
      },
    ];

    const html = render(row);
    expect(html).toContain("lg:grid-cols-3");
    expect(html).not.toContain("justify-between");
  });
});

describe("keyboard and content safety", () => {
  it("gives every link a visible focus ring", () => {
    const html = render([
      {
        id: "band",
        type: "section",
        children: [{ id: "cta", type: "button", label: "Plan Your Visit", href: "/contact" }],
      },
    ] as PageBlocks);

    expect(html).toContain("focus-visible:ring-2");
  });

  it("reserves an image's ratio so a church's photo does not shift the page", () => {
    const html = render([
      {
        id: "band",
        type: "section",
        children: [
          {
            id: "photo",
            type: "image",
            src: "https://example.com/sanctuary.jpg",
            alt: "The sanctuary on a Sunday morning",
          },
        ],
      },
    ] as PageBlocks);

    expect(html).toMatch(/<img[^>]+width="1600"/);
    expect(html).toMatch(/<img[^>]+height="1200"/);
    expect(html).toMatch(/<img[^>]+loading="lazy"/);
    expect(html).toContain('alt="The sanctuary on a Sunday morning"');
  });
});

/**
 * The first thing a church sees on their own homepage.
 *
 * A site is generated before it has a single sermon or event, so on day one
 * every collection band on the page is this component. The version it replaced
 * put a 112px brand gradient slab where a card's photograph would go — which
 * read as a broken image — with a dashed border under it, which read as
 * unfinished.
 */
describe("a collection with nothing in it", () => {
  const band = (type: string): PageBlocks =>
    [{ id: "band", type: "section", children: [{ id: "body", type }] }] as unknown as PageBlocks;

  it("speaks in one voice per collection", () => {
    expect(render(band("sermonCollection"))).toContain("Your next sermon will land here soon.");
    expect(render(band("eventCollection"))).toContain("the next gathering is being planned");
    expect(render(band("ministryCollection"))).toContain("Groups and teams are being added soon.");
  });

  /**
   * The regression this component exists to fix. A gradient block in the
   * position a photograph would occupy reads as a failed load, and a dashed
   * border under it reads as a page that is still building itself.
   */
  it("shows no gradient slab and no dashed border", () => {
    for (const type of ["sermonCollection", "eventCollection", "ministryCollection"]) {
      const html = render(band(type));
      expect(html, type).not.toContain("linear-gradient");
      expect(html, type).not.toContain("border-dashed");
    }
  });

  /**
   * The collection views early-return this, bypassing their own `grid w-full`
   * wrapper — so without `w-full` the card is only as wide as its sentence.
   * That has regressed before.
   */
  it("fills the band rather than shrinking to its sentence", () => {
    expect(render(band("sermonCollection"))).toContain("w-full");
  });

  /**
   * `featured` has a SECOND guard — it re-checks after picking the featured
   * sermon — and the two are easy to update separately.
   */
  it("renders the same card from the featured layout's own guard", () => {
    const featured = [
      {
        id: "band",
        type: "section",
        children: [{ id: "body", type: "sermonCollection", layout: "featured" }],
      },
    ] as unknown as PageBlocks;

    expect(render(featured)).toContain("Your next sermon will land here soon.");
    expect(render(featured)).not.toContain("linear-gradient");
  });
});
