import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ART_DIRECTIONS, artDirectionById } from "@/lib/ai/agents/catalog";
import {
  STOCK_HERO_IMAGES,
  buildHeroBand,
  isStockImage,
  pickHeroImage,
  resolveHeroCopy,
  type HeroCopy,
} from "@/lib/site/blocks/hero";
import { applyDesignPass, enforceBlockLegibility } from "@/lib/site/blocks/design-pass";
import type { BlockNode, PageBlocks } from "@/lib/site/blocks/types";
import type { SiteConfig, SiteContent } from "@/lib/site/types";
import { paddingClass } from "@/components/website/blocks/tokens";

/**
 * The hero's measurements, asserted against rendered markup.
 *
 * `tests/design-pass.test.ts` proves the right band is built; this proves the
 * band turns into the right pixels. Both are needed because the archetypes
 * differ almost entirely in classes — a hero that composes correctly and
 * renders at the wrong scale looks exactly like a hero that composes wrong.
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
  navigation: [{ label: "Home", href: "/" }],
  contact: {},
  socialLinks: [],
} as unknown as SiteConfig;
const content = { sermons: [], events: [] } as unknown as SiteContent;

const COPY: HeroCopy = {
  headline: "A church on the corner of Ashfield and Vine",
  subhead: "Two services every Sunday, and coffee on the steps after both.",
  ctaLabel: "Plan your visit",
  ctaHref: "/contact",
};

function renderHero(directionId: string, copy: HeroCopy = COPY): string {
  const direction = artDirectionById(directionId);
  if (!direction) throw new Error(`no direction "${directionId}"`);
  const band = buildHeroBand(direction.recipe.hero, copy, directionId);
  return renderToStaticMarkup(
    createElement(BlockTree, { nodes: [band] as PageBlocks, site, content }) as never
  );
}

function findAll(nodes: BlockNode[], type: string): BlockNode[] {
  const out: BlockNode[] = [];
  const walk = (list: BlockNode[]) => {
    for (const node of list) {
      if (node.type === type) out.push(node);
      if ("children" in node && Array.isArray(node.children)) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

describe("every hero opens on a real photograph", () => {
  it("seeds one on build day, with no church upload", () => {
    for (const direction of ART_DIRECTIONS) {
      const html = renderHero(direction.id);
      expect(html, `${direction.id} has no photograph`).toContain("https://8qsia8g9sr.ufs.sh/");
    }
  });

  it("never renders on a plain white background", () => {
    for (const direction of ART_DIRECTIONS) {
      const html = renderHero(direction.id);
      // A photograph behind the band...
      const opensOnPhoto = html.includes("absolute inset-0 -z-10");
      const opensOnTint = html.includes("bg-site-primary/5");
      // ...or photographs IN it. The gallery archetype's frames are content
      // cells rather than a background layer, so the band itself is
      // transparent and the pictures are still the first thing on the page.
      // Every other archetype renders exactly one frame; a grid renders three.
      const frames = html.split("8qsia8g9sr.ufs.sh").length - 1;
      const opensOnGallery = frames >= 3;

      expect(
        opensOnPhoto || opensOnTint || opensOnGallery,
        `${direction.id} opens on nothing`
      ).toBe(true);
    }
  });

  it("picks from the set its archetype is shot for", () => {
    for (const direction of ART_DIRECTIONS) {
      const kind = direction.recipe.hero.image;
      const html = renderHero(direction.id);
      const used = (STOCK_HERO_IMAGES[kind] as readonly string[]).some((url) =>
        html.includes(url)
      );
      expect(used, `${direction.id} used a photo outside its ${kind} set`).toBe(true);
    }
  });

  it("reserves the dark-graded overlay set for heroes that paint a scrim", () => {
    for (const direction of ART_DIRECTIONS) {
      if (direction.recipe.hero.archetype === "overlay") continue;
      expect(direction.recipe.welcomeImage, `${direction.id} seeds a welcome band`).not.toBe(
        "overlay"
      );
    }
  });
});

describe("the shared measurements", () => {
  /**
   * The headline is the page's single loudest voice and the subhead is set in
   * the display face at the church's accent colour — that pairing is the
   * detail that most separates the reference designs from a default stack of
   * bold-heading-plus-grey-paragraph.
   */
  it("sets the headline at display scale on a two-line measure", () => {
    for (const direction of ART_DIRECTIONS) {
      const html = renderHero(direction.id);
      expect(html, direction.id).toMatch(/<h1[^>]*class="[^"]*text-5xl/);
      expect(html, direction.id).toContain("max-w-2xl");
      expect(html, direction.id).toContain("lg:text-6xl");
    }
  });

  /**
   * Every reference pairs a rounded-sans headline with a SERIF subhead. It
   * takes an explicit font token: `app/globals.css` pins every heading inside
   * `.theme-root` to `font-family: inherit` — the primary face — so a
   * `heading` does NOT pick up the church's second face on its own, which is
   * what made the two lines read as one block of type.
   */
  it("sets the subhead in the church's SECOND face, at regular weight", () => {
    for (const direction of ART_DIRECTIONS) {
      const band = buildHeroBand(
        artDirectionById(direction.id)!.recipe.hero,
        COPY,
        direction.id
      );
      const subhead = findAll([band], "heading").find((n) => n.id === "hero-subhead");

      expect(subhead, `${direction.id} has no subhead heading`).toBeDefined();
      expect(subhead).toMatchObject({ scale: "h3", weight: "regular", font: "secondary" });
    }
  });

  it("renders that as the font-site-secondary utility, which beats the base layer", () => {
    const html = renderHero("cinematic");
    expect(html).toContain("font-site-secondary");
  });

  /**
   * Accent on a light ground, white over a dark photograph, grey under a veil.
   * An accent colour that reads beautifully on cream can fall under the
   * contrast floor once it is sitting on a scrim — and it falls under it again
   * over a near-white frame, from the other direction.
   */
  it("tints the subhead for its ground", () => {
    const EXPECTED: Record<string, string> = {
      overlay: "inverted",
      card: "inverted",
      gallery: "accent",
      veil: "muted",
      split: "accent",
      stacked: "accent",
    };

    for (const direction of ART_DIRECTIONS) {
      const band = buildHeroBand(
        artDirectionById(direction.id)!.recipe.hero,
        COPY,
        direction.id
      );
      const subhead = findAll([band], "heading").find((n) => n.id === "hero-subhead");

      expect(subhead?.style?.textTone, direction.id).toBe(
        EXPECTED[direction.recipe.hero.archetype]
      );
    }
  });

  it("sets the button label in the second face too", () => {
    const band = buildHeroBand(artDirectionById("cinematic")!.recipe.hero, COPY, "x");
    const cta = findAll([band], "button")[0];
    expect(cta).toMatchObject({ font: "secondary" });
  });

  /** No reference uses a pill; all three sit at roughly a 6px corner. */
  /**
   * A pill is a deliberate house style, not a default. `card` opts into one
   * through the radius token; every other archetype keeps the shared control
   * radius, and a stray `rounded-full` anywhere else would mean a button had
   * picked one up by accident.
   */
  it("rounds the button into a pill only where the direction asked for one", () => {
    for (const direction of ART_DIRECTIONS) {
      const pill = direction.recipe.hero.archetype === "card";
      const html = renderHero(direction.id);

      if (pill) expect(html, direction.id).toContain("rounded-full");
      else expect(html, direction.id).not.toContain("rounded-full");
    }
  });

  it("gives the button a 44px tap target", () => {
    for (const direction of ART_DIRECTIONS) {
      expect(renderHero(direction.id), direction.id).toContain("h-11");
    }
  });

  it("puts extra air between the subhead and the button", () => {
    // A stack has one uniform gap, so the reference's wider gap before the
    // button can only be a spacer.
    const band = buildHeroBand(artDirectionById("cinematic")!.recipe.hero, COPY, "x");
    expect(findAll([band], "spacer").length).toBeGreaterThan(0);
  });
});

describe("archetype A — photo, overlay, text over image", () => {
  it("fills the band and centres the copy vertically", () => {
    const html = renderHero("cinematic");
    expect(html).toContain("min-h-[70vh]");
    expect(html).toContain("lg:min-h-[78vh]");
    expect(html).toContain("justify-center");
  });

  it("paints a horizontal gradient for ranged-left copy", () => {
    expect(renderHero("cinematic")).toContain("bg-gradient-to-r");
  });

  /**
   * The alignment target: a full-bleed hero's copy sits at the page gutter and
   * nothing else, which is the same inset the nav logo takes.
   */
  it("lands the copy on the nav's axis", () => {
    const html = renderHero("cinematic");
    expect(html).toContain("px-6 lg:px-14");
    expect(html).not.toContain("max-w-6xl");
  });

  it("loads its photograph eagerly — it is the largest contentful paint", () => {
    const html = renderHero("cinematic");
    expect(html).toMatch(/<img[^>]+fetchpriority="high"/i);
    expect(html).not.toMatch(/<img[^>]+loading="lazy"/);
  });

  /**
   * `enforceBlockLegibility` sees a `transparent`-ish band and would otherwise
   * strip the white type, rendering the whole archetype dark-on-dark.
   */
  it("keeps its white type through the legibility pass", () => {
    const direction = artDirectionById("cinematic")!;
    const blocks = applyDesignPass(
      [{ id: "cta", type: "section", children: [] }] as unknown as PageBlocks,
      { hero: COPY, siteId: "x", churchName: "Test" },
      direction.recipe
    );
    const hero = blocks.find((node) => node.id === "hero");
    const stack = findAll([hero!], "stack")[0];
    expect(stack.style?.textTone).toBe("inverted");
  });
});

describe("archetype B — asymmetric split, photo bleeding to one edge", () => {
  it("splits 3fr/2fr rather than in half", () => {
    expect(renderHero("warm-editorial")).toContain("lg:grid-cols-[3fr_2fr]");
  });

  it("bleeds the photo to the viewport edge with no rounding or gutter", () => {
    const html = renderHero("warm-editorial");
    // `fill` has no ratio box: the photo matches the text column's height.
    expect(html).toContain("h-full min-h-full w-full object-cover");
    expect(html).not.toContain("rounded-2xl");
  });

  /**
   * Below `lg` the grid is one column. A phone visitor must not meet a
   * full-height photograph before any words, so the mirrored variant mirrors
   * visually — never by putting the image first in the DOM.
   */
  it("keeps the copy ahead of the photo in DOM order, both ways round", () => {
    for (const id of ["warm-editorial", "community-forward"]) {
      const html = renderHero(id);
      const headline = html.indexOf("Ashfield");
      // The `<img>` itself, not the URL: React floats a `<link rel="preload">`
      // for an eager image to the very front of the markup, which is correct
      // and has nothing to do with where the picture renders.
      const photo = html.indexOf("<img");
      expect(headline, `${id}: no headline`).toBeGreaterThan(-1);
      expect(photo, `${id}: no photo`).toBeGreaterThan(-1);
      expect(headline, `${id} puts the photograph above the headline`).toBeLessThan(photo);
    }
  });

  it("floors the band so a short headline cannot collapse the photo to a strip", () => {
    expect(renderHero("warm-editorial")).toContain("min-h-[70vh]");
  });
});

describe("archetype C — centred copy, widescreen photo beneath", () => {
  it("contains the photograph at its own measure, with square corners", () => {
    // `design-references/Hero3.png` — a contained 16/9 photograph with square
    // corners, at a wider measure than the copy above it.
    const traditional = renderHero("traditional-reverent");
    expect(traditional).toContain("aspect-video");
    expect(traditional).toContain("max-w-6xl");
    expect(traditional).not.toContain("rounded-2xl");
  });

  it("centres the copy at a contained measure", () => {
    expect(renderHero("traditional-reverent")).toContain("items-center text-center");
  });
});

/**
 * `design-references/Hero6.png` — copy on one side, a grid of photographs on
 * the other. Distinct from archetype B, which is ONE photograph bleeding to the
 * viewport edge: a gallery is contained, tiled and guttered, and reads as a set
 * of glimpses of a congregation rather than an establishing shot of a building.
 */
describe("archetype F — copy beside a grid of photographs", () => {
  const community = renderHero("community-forward");

  it("puts the copy first and the grid beside it", () => {
    expect(community).toContain("lg:grid-cols-[3fr_2fr]");
  });

  it("draws three distinct frames rather than repeating one", () => {
    const urls = community.match(/https:\/\/8qsia8g9sr\.ufs\.sh\/f\/[A-Za-z0-9]+/g) ?? [];
    const distinct = new Set(urls);
    expect(distinct.size).toBeGreaterThanOrEqual(3);
  });

  /**
   * `rowLayoutClass["wide-left"]` carries no `items-*`, so the copy column is
   * stretched by the taller grid beside it and would otherwise pin its content
   * to the top of that cell.
   */
  it("centres the copy column against the taller grid", () => {
    expect(community).toContain("justify-center");
  });

  it("loads only the first cell eagerly", () => {
    const band = buildHeroBand(artDirectionById("community-forward")!.recipe.hero, COPY, "x");
    const cells = findAll([band], "image");
    expect(cells.length).toBeGreaterThanOrEqual(3);
    expect(cells.filter((c) => (c as { priority?: boolean }).priority)).toHaveLength(1);
  });

  /**
   * `applyDesignPass` runs `capEmptyImages` with a budget of one before
   * anything else, dropping every empty `image` past the first. Gallery cells
   * all carry a real `src` so they are safe — but only because the grid is
   * built with sources rather than seeded later, which is the kind of
   * interaction that breaks quietly.
   */
  it("survives the empty-photo cap with every cell intact", () => {
    const direction = artDirectionById("community-forward")!;
    const page = [
      { id: "nav", type: "section", children: [{ id: "nav-brand", type: "brandLogo" }] },
      {
        id: "welcome",
        type: "section",
        children: [
          { id: "welcome-heading", type: "heading", scale: "h2", text: "Who gathers here" },
          { id: "welcome-photo", type: "image" },
        ],
      },
      { id: "footer", type: "section", children: [{ id: "footer-copy", type: "copyrightLine" }] },
    ] as unknown as PageBlocks;

    const result = applyDesignPass(
      page,
      { siteId: "site_1", churchName: "Hail Mary", hero: COPY },
      direction.recipe
    );
    const hero = result.find((n) => n.id === "hero");
    expect(findAll([hero as BlockNode], "image").length).toBeGreaterThanOrEqual(3);
  });
});

/**
 * `design-references/Hero4.png` — archetype A's photography, held completely
 * differently. The frame is inset from every viewport edge with rounded
 * corners, so the page shows around it and the navigation has a top edge to sit
 * above rather than over.
 */
describe("archetype E — the photograph as an inset card", () => {
  const bright = renderHero("bright-welcoming");

  it("holds the frame off the viewport edge and rounds it", () => {
    expect(bright).toContain("mx-3");
    expect(bright).toContain("rounded-3xl");
    // A radius without a clip is no radius at all: the background photograph
    // squares the corners straight back off.
    expect(bright).toContain("overflow-hidden");
  });

  it("sits the copy on the frame's bottom edge, not its centre", () => {
    // Read off the <section> itself: `justify-center` also comes from
    // `buttonVariants` further down the markup, so a whole-document match
    // would pass whatever the band did.
    const sectionClass = bright.match(/<section class="([^"]*)"/)?.[1] ?? "";
    expect(sectionClass).toContain("justify-end");
    expect(sectionClass).not.toContain("justify-center");
  });

  it("puts the call to action opposite the copy, on a shared bottom edge", () => {
    // `bar-end`, not `bar`: `items-center` would float the button level with
    // the headline instead of the subhead.
    expect(bright).toContain("items-end justify-between");
  });

  /**
   * A bottom-weighted wash, so the type is legible without fogging the part of
   * the photograph the eye actually went to.
   */
  it("darkens the foot of the frame rather than the whole of it", () => {
    expect(bright).toContain("bg-gradient-to-t");
    expect(bright).not.toContain("bg-black/55");
  });

  /**
   * `effectiveSurface()` reads a photo under a darkening overlay as a dark
   * surface so white type survives the legibility pass. Miss `base` there and
   * the hero's copy is stripped to dark-on-dark.
   */
  it("keeps its white copy through the legibility pass", () => {
    const band = buildHeroBand(artDirectionById("bright-welcoming")!.recipe.hero, COPY, "x");
    const subhead = findAll(enforceBlockLegibility([band]), "heading").find(
      (n) => n.id === "hero-subhead"
    );
    expect(subhead?.style?.textTone).toBe("inverted");
  });
});

/**
 * `design-references/Hero5.png` — the photographic inverse of archetype A. A
 * high-key frame lifted by a white wash, with the page's own DARK type on it,
 * where A is a dark-graded frame under a black scrim carrying white type.
 */
describe("archetype D — dark copy over a high-key photograph", () => {
  const minimal = renderHero("modern-minimal");

  it("lifts the frame with a white veil rather than darkening it", () => {
    expect(minimal).toContain("from-white/70");
    expect(minimal).not.toContain("bg-black/55");
    expect(minimal).not.toContain("from-black/75");
  });

  /**
   * The band must NOT read as inverted. `effectiveSurface()` treats a photo
   * under a `scrim`/`dark` overlay as a dark surface so white type survives;
   * a veil band is light, and marking it inverted would make
   * `enforceBlockLegibility` strip the dark tones and render the headline
   * white on white.
   */
  it("stays a light surface, so the copy keeps the page's own ink", () => {
    const band = buildHeroBand(artDirectionById("modern-minimal")!.recipe.hero, COPY, "x");
    expect(band.style?.background).toBe("transparent");
    expect(band.style?.overlay).toBe("veil");

    const kept = enforceBlockLegibility([band]);
    const headline = findAll(kept, "heading").find((n) => n.id === "hero-headline");
    expect(headline?.style?.textTone).toBeUndefined();
  });

  it("takes the whole first screen, in svh", () => {
    expect(minimal).toContain("min-h-svh");
  });

  /** The `light` set puts its subject low in the frame; the copy sits above it. */
  it("lifts the copy above the optical centre with a floor spacer", () => {
    const band = buildHeroBand(artDirectionById("modern-minimal")!.recipe.hero, COPY, "x");
    const children = (band as { children: { id: string }[] }).children;
    expect(children[children.length - 1].id).toBe("hero-floor");
  });

  /** This reference matches the button to its serif headline, not the subhead. */
  it("sets the button label in the headline's face", () => {
    const band = buildHeroBand(artDirectionById("modern-minimal")!.recipe.hero, COPY, "x");
    expect(findAll([band], "button")[0]).toMatchObject({ font: "primary" });
  });
});

describe("the photograph is stable, and stable per church", () => {
  it("gives the same site the same photo every build", () => {
    expect(pickHeroImage("overlay", "site-abc")).toBe(pickHeroImage("overlay", "site-abc"));
  });

  it("avoids the photo the last build used", () => {
    const first = pickHeroImage("vertical", "site-abc");
    const second = pickHeroImage("vertical", "site-abc", first);
    expect(second).not.toBe(first);
  });

  it("still returns a photo when every option is excluded", () => {
    const only = STOCK_HERO_IMAGES.widescreen[0];
    // Not a real case, but a template that shrank to one URL must not return
    // undefined and render an empty hero.
    expect(pickHeroImage("widescreen", "x", only)).toBeTruthy();
  });

  it("recognises its own photos, so the upload flow can offer to replace them", () => {
    expect(isStockImage(STOCK_HERO_IMAGES.overlay[0])).toBe(true);
    expect(isStockImage("https://example.com/a-church-photo.jpg")).toBe(false);
    expect(isStockImage(undefined)).toBe(false);
  });
});

describe("copy fallbacks", () => {
  const ctx = {
    churchName: "Hail Mary Community",
    tagline: "A church on the corner",
    story: { mission: "We feed our neighbours. We have since 1974.", values: "Hospitality." },
  };

  it("falls back to the church's own words, in order", () => {
    expect(resolveHeroCopy({}, ctx).headline).toBe("A church on the corner");
    expect(resolveHeroCopy({}, { churchName: "St Anne's" }).headline).toBe("St Anne's");
  });

  it("takes only the first sentence of a mission for a subhead", () => {
    expect(resolveHeroCopy({}, ctx).subhead).toBe("We feed our neighbours.");
  });

  /**
   * An omitted subhead has to shrink the stack, not leave a gap — so the
   * fallback is an empty string that the builder drops, never filler text.
   */
  it("omits the subhead node entirely when there is nothing true to say", () => {
    const copy = resolveHeroCopy({}, { churchName: "St Anne's" });
    expect(copy.subhead).toBe("");

    const band = buildHeroBand(artDirectionById("cinematic")!.recipe.hero, copy, "x");
    expect(findAll([band], "heading").map((n) => n.id)).not.toContain("hero-subhead");
  });

  it("points the button at contact only when the church has a contact page", () => {
    expect(resolveHeroCopy({}, { churchName: "X", hasContactPage: true }).ctaHref).toBe("/contact");
    expect(resolveHeroCopy({}, { churchName: "X" }).ctaHref).toBe("/about");
  });

  it("names an action rather than leaving a bare label", () => {
    expect(resolveHeroCopy({}, { churchName: "X" }).ctaLabel).toBe("Plan your visit");
  });
});

describe("the band and its photograph size independently", () => {
  /**
   * Three containers ignored `style.width` / `style.padding` until the
   * references exposed it: the split hero's photograph could not reach the
   * viewport edge through a padded band, and the stacked hero's `photoWidth`
   * and `copyWidth` were silently doing nothing at all.
   */
  it("bleeds the split archetype's band so the photo reaches the edge", () => {
    const html = renderHero("warm-editorial");
    const section = (html.match(/<section[^>]*>/) ?? [""])[0];

    expect(section).not.toContain("px-6");
    expect(section).not.toContain("max-w-");
    // The text column carries the gutter instead. The padding comes from the
    // token rather than a literal, so re-tuning the scale does not fail a test
    // about where the gutter lives.
    expect(html).toContain(`${paddingClass["2xl"]} w-full px-6 lg:px-14`);
  });

  it("contains the stacked archetype's photo at its own measure", () => {
    const html = renderHero("traditional-reverent");
    const traditional = artDirectionById("traditional-reverent")!.recipe.hero;
    if (traditional.archetype !== "stacked") throw new Error("expected a stacked hero");

    // Both measures on one band, and they are not the same one: the copy sits
    // at `copyWidth` (max-w-4xl) and the photograph runs wider at `photoWidth`
    // (max-w-6xl), which is the proportion `design-references/Hero3.png` sets.
    expect(html).toContain("max-w-4xl");
    expect(html).toContain("max-w-6xl");
  });

  it("loads the stacked archetype's photo eagerly — it is inside the first viewport", () => {
    const html = renderHero("traditional-reverent");
    expect(html).toMatch(/<img[^>]+loading="eager"/);
    expect(html).not.toMatch(/<img[^>]+loading="lazy"/);
  });
});
