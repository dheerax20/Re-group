import { describe, expect, it } from "vitest";
import { applyDesignPass } from "@/lib/site/blocks/design-pass";
import { ART_DIRECTIONS } from "@/lib/ai/agents/catalog";
import { contentWidthFor, estimateBandHeight } from "@/lib/site/blocks/measure";
import { SITE_TEMPLATES } from "@/lib/site/templates";
import { NAV_BLOCK_ID, FOOTER_BLOCK_ID, HERO_BLOCK_ID } from "@/lib/site/blocks/types";
import type { BlockNode, PageBlocks } from "@/lib/site/blocks/types";
import { defaultBrandConfig } from "@/lib/validation/brand";
import { defaultFeatures } from "@/lib/features/types";

/**
 * The band-height gate.
 *
 * A generated homepage's second band runs well past a viewport — the symptom
 * WS-A exists to fix — and nothing in the suite could see it, because band
 * height is a property of the rendered page and the suite has no browser.
 * `lib/site/blocks/measure.ts` derives the height from the same tokens the
 * renderer reads instead, and deliberately under-estimates, so a band this
 * calls too tall IS too tall.
 *
 * The 1.15 × viewport assertion went live with the content-height ceiling that
 * made it pass. `BAND_HEIGHT_REPORT=1` prints every band's measured height,
 * which is the before/after record for any change to the rhythm or the tokens.
 */

/** Desktop and phone, the two the audit is specified against. */
const VIEWPORTS = [
  { name: "1440x900", vw: 1440, vh: 900 },
  { name: "390x844", vw: 390, vh: 844 },
] as const;

/** No content band may exceed this much of the viewport it is read on. */
const CEILING = 1.15;

/**
 * Nav, hero and footer are rhythm-exempt and height-exempt for the same
 * reason: each is authored rather than composed, and the hero's `minHeight`
 * floor is a deliberate 78vh. `isRhythmExempt` in `design-pass.ts` draws the
 * identical line.
 */
function contentBands(blocks: PageBlocks): BlockNode[] {
  return blocks.filter(
    (node) =>
      node.type === "section" &&
      node.id !== NAV_BLOCK_ID &&
      node.id !== FOOTER_BLOCK_ID &&
      node.id !== HERO_BLOCK_ID
  );
}

/**
 * A page with the shape the pass actually meets: a welcome band carrying a
 * photograph (the band WS-A is about), two data-bound bands, and a closing
 * band. `applyDesignPass` assigns every background, padding and width.
 */
function fixturePage(): PageBlocks {
  return [
    { id: "nav", type: "section", children: [{ id: "nav-brand", type: "brandLogo" }] },
    {
      id: "welcome",
      type: "section",
      children: [
        { id: "welcome-heading", type: "heading", scale: "h2", text: "Who gathers here" },
        {
          id: "welcome-text",
          type: "text",
          text:
            "We are a church on the corner of Ashfield and Vine, and we have been here for " +
            "sixty years. Sunday mornings are the centre of our week, and everyone is welcome " +
            "at them exactly as they are.",
        },
        { id: "welcome-photo", type: "image" },
      ],
    },
    { id: "sermons", type: "section", children: [{ id: "sermons-list", type: "sermonCollection" }] },
    { id: "events", type: "section", children: [{ id: "events-list", type: "eventCollection" }] },
    {
      id: "cta",
      type: "section",
      children: [
        { id: "cta-heading", type: "heading", scale: "h2", text: "Come this Sunday" },
        { id: "cta-button", type: "button", label: "Plan your visit", href: "/contact" },
      ],
    },
    { id: "footer", type: "section", children: [{ id: "footer-copyright", type: "copyrightLine" }] },
  ] as unknown as PageBlocks;
}

const fixtureContext = {
  features: { sermons: true, events: true, giving: true, contact: true },
  story: { mission: "We feed people." },
};

const templateProfile = {
  siteId: "site_measure",
  churchName: "Hail Mary Community",
  tagline: "A church on the corner of Ashfield and Vine",
  story: { city: "Ashfield", serviceTimes: "Sundays at 9am and 11am." },
  features: { ...defaultFeatures, giving: true, ministries: true },
  brand: defaultBrandConfig,
} as never;

describe("the model matches the renderer's own arithmetic", () => {
  /**
   * `widthClass` is `mx-auto w-full max-w-Nxl px-6 lg:px-14`, so the measure
   * caps the PADDED box and the gutter comes off the inside. Reading it the
   * other way overstates every image by 112px at `lg`, which would make the
   * model over-estimate — the one thing it must never do.
   */
  it("takes the gutter out of the measure, not off it", () => {
    // max-w-6xl is 72rem = 1152, less px-14 both sides.
    expect(contentWidthFor("wide", 1440)).toBe(1152 - 112);
    // Below the measure the viewport wins, and the gutter is the smaller px-6.
    expect(contentWidthFor("wide", 390)).toBe(390 - 48);
    // `full` is gutter-only, `bleed` is neither.
    expect(contentWidthFor("full", 1440)).toBe(1440 - 112);
    expect(contentWidthFor("bleed", 1440)).toBe(1440);
  });

  it("applies the padding fallback an absent token still renders", () => {
    // `containerStyle` is `paddingClass[style?.padding ?? "lg"]`. A band with
    // no padding token is not 0.
    const bare = { id: "b", type: "section", children: [] } as unknown as BlockNode;
    expect(estimateBandHeight(bare, 1440, 900)).toBe(144);
  });

  /**
   * `paddingClass` is responsive. A reader that took the first `py-*` in the
   * string would measure a desktop band at its phone padding, under-reporting
   * every band by 64-128px — and the gate above would go green on a page that
   * never changed, which is worse than the overflow it was built to catch.
   */
  it("resolves a responsive padding step against the viewport", () => {
    const bare = { id: "b", type: "section", children: [] } as unknown as BlockNode;
    // `lg` is py-12 sm:py-14 lg:py-18 2xl:py-20 -> 96 / 112 / 144 / 160, both
    // sides. The 2xl case is the one a reader that stopped at `lg` would get
    // wrong, and it would get it wrong silently.
    expect(estimateBandHeight(bare, 1600, 900)).toBe(160);
    expect(estimateBandHeight(bare, 1440, 900)).toBe(144);
    expect(estimateBandHeight(bare, 800, 900)).toBe(112);
    expect(estimateBandHeight(bare, 390, 844)).toBe(96);
  });

  it("caps a content photograph lower than the hero's", () => {
    // portrait (4/5) in a `normal` band at 1440: 784px wide wants 980px tall,
    // so both ceilings bite and the only difference is which one.
    const band = (maxHeight?: "hero" | "content") =>
      ({
        id: "b",
        type: "section",
        style: { width: "normal", padding: "none" },
        children: [
          { id: "photo", type: "image", aspect: "portrait", src: "https://x/y.jpg", maxHeight },
        ],
      }) as unknown as BlockNode;

    expect(estimateBandHeight(band("hero"), 1440, 900)).toBeCloseTo(0.7 * 900, 5);
    expect(estimateBandHeight(band("content"), 1440, 900)).toBeCloseTo(0.52 * 900, 5);
    // An image that says nothing is a content image — only the hero opts in.
    expect(estimateBandHeight(band(undefined), 1440, 900)).toBeCloseTo(0.52 * 900, 5);
  });

  it("reads a row as its tallest child once it stops collapsing", () => {
    const row = (vw: number) => {
      const band = {
        id: "b",
        type: "section",
        style: { width: "wide", padding: "none", gap: "none" },
        children: [
          {
            id: "r",
            type: "row",
            columns: 2,
            style: { gap: "none" },
            children: [
              { id: "a", type: "image", aspect: "square", src: "https://x/a.jpg" },
              { id: "c", type: "image", aspect: "square", src: "https://x/c.jpg" },
            ],
          },
        ],
      } as unknown as BlockNode;
      return estimateBandHeight(band, vw, 4000);
    };
    // At 1440 two square cells sit side by side: one cell's height, 1040/2.
    expect(row(1440)).toBeCloseTo(520, 5);
    // At 390 the grid is one column, so it is both of them stacked.
    expect(row(390)).toBeCloseTo(342 * 2, 5);
  });
});

/**
 * Live since the content-height ceiling landed.
 *
 * Before it, the offender was the SAME band in every direction — `welcome`,
 * the one WS-A's screenshots are of — and nothing else on the page cleared
 * 0.62vh:
 *
 *     traditional-reverent  welcome  1062px  1.18vh   <- over
 *     bright-welcoming      welcome  1051px  1.17vh   <- over
 *     warm-editorial        welcome  1032px  1.15vh   <- on the line
 *     community-forward     welcome  1032px  1.15vh   <- on the line
 *
 * A photograph took the hero's 70svh ceiling in a band where it was one of
 * four children. Splitting that into `imageMaxHeightClass` is what this now
 * holds: the worst band is 934px (1.04vh), and the margin to the ceiling is
 * ~100px on a model that deliberately under-estimates.
 */
describe("no content band is taller than the screen it is read on", () => {
  for (const viewport of VIEWPORTS) {
    describe(viewport.name, () => {
      for (const direction of ART_DIRECTIONS) {
        it(`${direction.id} keeps every band under ${CEILING} viewports`, () => {
          const blocks = applyDesignPass(fixturePage(), fixtureContext, direction.recipe);
          for (const band of contentBands(blocks)) {
            expect(
              estimateBandHeight(band, viewport.vw, viewport.vh),
              `${direction.id} / ${band.id}`
            ).toBeLessThanOrEqual(CEILING * viewport.vh);
          }
        });
      }

      for (const template of SITE_TEMPLATES) {
        it(`the ${template.id} template keeps every band under ${CEILING} viewports`, () => {
          for (const band of contentBands(template.buildHome(templateProfile))) {
            expect(
              estimateBandHeight(band, viewport.vw, viewport.vh),
              `${template.id} / ${band.id}`
            ).toBeLessThanOrEqual(CEILING * viewport.vh);
          }
        });
      }
    });
  }
});

/**
 * The measured state of the page today, so the gate above has a baseline to be
 * un-skipped against and a regression in the other direction is visible.
 *
 * Run with `BAND_HEIGHT_REPORT=1 npx vitest run tests/band-heights.test.ts`.
 */
describe.runIf(process.env.BAND_HEIGHT_REPORT)("report", () => {
  it("prints every band's height", () => {
    const rows: string[] = [];
    for (const viewport of VIEWPORTS) {
      for (const template of SITE_TEMPLATES) {
        for (const band of contentBands(template.buildHome(templateProfile))) {
          const px = Math.round(estimateBandHeight(band, viewport.vw, viewport.vh));
          const ratio = (px / viewport.vh).toFixed(2);
          rows.push(`${viewport.name}  ${template.id.padEnd(15)} ${band.id.padEnd(14)} ${String(px).padStart(5)}px  ${ratio}vh`);
        }
      }
      for (const direction of ART_DIRECTIONS) {
        const blocks = applyDesignPass(fixturePage(), fixtureContext, direction.recipe);
        for (const band of contentBands(blocks)) {
          const px = Math.round(estimateBandHeight(band, viewport.vw, viewport.vh));
          const ratio = (px / viewport.vh).toFixed(2);
          rows.push(`${viewport.name}  ${direction.id.padEnd(15)} ${band.id.padEnd(14)} ${String(px).padStart(5)}px  ${ratio}vh`);
        }
      }
    }
    console.log("\n" + rows.join("\n") + "\n");
    expect(rows.length).toBeGreaterThan(0);
  });
});
