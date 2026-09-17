import { describe, expect, it } from "vitest";
import { imageAspectClass, imageMaxHeightClass } from "@/components/website/blocks/tokens";
import { coerceBlocks } from "@/lib/site/blocks/schema";
import { estimateBandHeight } from "@/lib/site/blocks/measure";
import type { BlockNode, PageBlocks } from "@/lib/site/blocks/types";

/**
 * An `image` block's height comes from its width and its ratio, and from
 * nothing else — so a tall ratio in a wide band renders a photograph taller
 * than the screen it is being read on. A `portrait` (4/5) image in a
 * `max-w-6xl` band is 1440px; at `width: "bleed"` it is half again bigger.
 *
 * The renderer caps that with `max-h-[70svh]`, which is only safe because the
 * `<img>` inside the ratio box is `object-cover`: the cap crops the photo
 * rather than distorting it. `fill` is the one aspect with no ratio box — it
 * returns early in the renderer and fills whatever cell the grid gave it, so
 * the hero's split column can match the height of the text beside it.
 *
 * These assert the shape that arrangement depends on. A ratio added to
 * `fill`, or dropped from any other token, breaks either the hero's split
 * archetype or the layout-shift guarantee, and neither failure is visible in
 * a diff that only touches this map.
 */
describe("image aspect tokens", () => {
  it("gives every aspect but `fill` a ratio box", () => {
    for (const [token, className] of Object.entries(imageAspectClass)) {
      if (token === "fill") continue;
      expect(className).toMatch(/\baspect-/);
    }
  });

  it("keeps `fill` ratio-free so it can size to its cell", () => {
    expect(imageAspectClass.fill).not.toMatch(/\baspect-/);
    expect(imageAspectClass.fill).toContain("object-cover");
  });
});

/**
 * The ratio box gives an image its shape; this gives it a ceiling. Two of
 * them, because the hero's photograph is meant to own the first screen and a
 * mid-page one is a quarter of a band — at one shared ceiling the welcome band
 * ran past a viewport in four of the six art directions.
 */
describe("image height ceilings", () => {
  it("holds a content photo to less of the screen than the hero's", () => {
    const svh = (c: string) => Number(c.match(/max-h-\[(\d+)svh\]/)![1]);
    expect(svh(imageMaxHeightClass.content)).toBeLessThan(svh(imageMaxHeightClass.hero));
  });

  /**
   * `svh`, not `vh`: `100vh` on mobile Safari exceeds the visible viewport.
   * `minHeightClass` learned this the hard way and this map inherits the rule.
   */
  it("measures against the small viewport unit", () => {
    for (const [token, value] of Object.entries(imageMaxHeightClass)) {
      expect(value, `imageMaxHeightClass.${token}`).toContain("svh");
      expect(value, `imageMaxHeightClass.${token}`).not.toMatch(/\d+vh\]/);
    }
  });

  /**
   * A silent-prune guard. `overlayClass` gained `veil` for the Modern Minimal
   * hero; miss it in `schema.ts`'s `overlaySchema` and
   * `coerceBlocks` prunes it, so the band renders the raw high-key photograph
   * with dark type straight on it and no error anywhere.
   */
  it("round-trips a veil overlay, so a light hero keeps its wash", () => {
    const blocks = [
      {
        id: "hero",
        type: "section",
        style: {
          backgroundImage: "https://example.com/steeple.jpg",
          overlay: "veil",
          background: "transparent",
          minHeight: "screen",
        },
        children: [{ id: "hero-headline", type: "heading", text: "Welcome" }],
      },
    ] as unknown as PageBlocks;

    expect(coerceBlocks(blocks)).toEqual(blocks);
  });

  /**
   * The guard for the whole class, rather than one token at a time.
   *
   * `schema.ts` lists the style fields TWICE — the `blockStyleSchema` object
   * shape and `STYLE_FIELD_SCHEMAS`, a few lines apart with no shared const
   * between them. Adding a field to one and not the other costs it with no
   * error anywhere: `coerceBlocks` simply drops it and the band renders its
   * default. Every field set at once, so a half-landed addition fails here.
   */
  it("round-trips every style field at once", () => {
    const style = {
      padding: "lg",
      gap: "md",
      align: "center",
      width: "wide",
      background: "surface",
      textTone: "muted",
      backgroundImage: "https://example.com/sanctuary.jpg",
      overlay: "base",
      minHeight: "hero",
      radius: "xl",
      inset: "md",
      verticalAlign: "bottom",
    };

    const blocks = [
      { id: "band", type: "section", style, children: [{ id: "h", type: "heading", text: "Hi" }] },
    ] as unknown as PageBlocks;

    const [out] = coerceBlocks(blocks) as unknown as [{ style: Record<string, unknown> }];
    expect(Object.keys(out.style).sort()).toEqual(Object.keys(style).sort());
    expect(out.style).toEqual(style);
  });

  /**
   * A gallery cell is `priority` (it is the page's largest contentful paint)
   * AND wants the shorter ceiling — four cells at the hero's 70svh is a contact
   * sheet, not a hero. That combination is the reason the ceiling is its own
   * token rather than keyed off `priority`, so it is worth asserting directly.
   */
  it("gives an eagerly-loaded gallery cell the content ceiling, not the hero's", () => {
    const cell = {
      id: "b",
      type: "section",
      style: { width: "wide", padding: "none" },
      children: [
        { id: "cell", type: "image", aspect: "portrait", src: "https://x/a.jpg", priority: true },
      ],
    } as unknown as BlockNode;

    expect(estimateBandHeight(cell, 1440, 900)).toBeCloseTo(0.52 * 900, 5);
  });

  /**
   * The same guard for `maxHeight`, which has to be listed on the image branch
   * of `schema.ts` — or `coerceBlocks` strips it with no error anywhere and the
   * hero's photograph quietly takes the content ceiling instead.
   */
  it("survives coerceBlocks, so the hero keeps its taller ceiling", () => {
    const blocks = [
      {
        id: "hero",
        type: "section",
        children: [
          {
            id: "hero-photo",
            type: "image",
            src: "https://example.com/sanctuary.jpg",
            aspect: "wide",
            priority: true,
            maxHeight: "hero",
          },
        ],
      },
    ] as unknown as PageBlocks;

    expect(coerceBlocks(blocks)).toEqual(blocks);
  });
});
