import { describe, expect, it } from "vitest";
import {
  PAGE_GUTTER,
  alignItemsClass,
  backgroundClass,
  fontWeightClass,
  gapClass,
  headingScaleClass,
  imageAspectClass,
  imageMaxHeightClass,
  imageTreatmentClass,
  minHeightClass,
  overlayClass,
  paddingClass,
  rowColumnsClass,
  rowLayoutClass,
  spacerHeightClass,
  stackGapClass,
  textScaleClass,
  textToneClass,
  widthClass,
} from "@/components/website/blocks/tokens";

/**
 * `tokens.ts` is the only place a style token becomes a Tailwind class, and it
 * carries two invariants that nothing else can enforce:
 *
 * 1. Responsiveness is structural, not an AI decision — so every multi-column
 *    layout has to collapse to one column before its first breakpoint. A token
 *    that forgets this ships a page that scrolls sideways on a phone, which no
 *    unit test elsewhere would catch.
 * 2. Every class is a literal string. Tailwind's scanner reads source text, so
 *    an interpolated class name compiles fine and then renders unstyled in
 *    production — the worst possible failure shape.
 */

/** Every token map, so a new enum member cannot be added without a class. */
const MAPS: Record<string, Record<string, string>> = {
  paddingClass,
  gapClass,
  stackGapClass,
  spacerHeightClass,
  alignItemsClass,
  widthClass,
  backgroundClass,
  textToneClass,
  headingScaleClass,
  textScaleClass,
  rowLayoutClass,
  overlayClass,
  minHeightClass,
  fontWeightClass,
  imageTreatmentClass,
  imageAspectClass,
  imageMaxHeightClass,
  rowColumnsClass: rowColumnsClass as unknown as Record<string, string>,
};

describe("every token resolves to a class", () => {
  it("has no undefined or whitespace-only entries", () => {
    for (const [name, map] of Object.entries(MAPS)) {
      for (const [token, value] of Object.entries(map)) {
        expect(typeof value, `${name}.${token}`).toBe("string");
        // `overlay.none`, `minHeight.none` and `align`'s no-op are legitimately
        // empty; nothing else may be.
        if (!["none"].includes(token)) {
          expect(value.trim(), `${name}.${token} is blank`).not.toBe("");
        }
      }
    }
  });
});

describe("multi-column layouts collapse on small screens", () => {
  /**
   * The invariant `rowLayoutClass`'s new asymmetric entries had to join: a
   * 3fr/2fr hero split that does not collapse puts a full-height photograph
   * beside a 140px-wide text column at 390px.
   */
  it("every grid token starts at one column", () => {
    const grids = [
      ...Object.entries(rowColumnsClass).map(([k, v]) => [`rowColumnsClass.${k}`, v] as const),
      ...Object.entries(rowLayoutClass)
        // `columns` is only the grid wrapper — its column count comes from
        // `rowColumnsClass`, which is asserted on its own above.
        .filter(([k, v]) => k !== "columns" && v.includes("grid"))
        .map(([k, v]) => [`rowLayoutClass.${k}`, v] as const),
    ];

    expect(grids.length).toBeGreaterThan(4);
    for (const [name, value] of grids) {
      expect(value, `${name} has no unprefixed grid-cols-1`).toContain("grid-cols-1");
      // Any multi-column class must be breakpoint-prefixed.
      const bare = value.match(/(?:^|\s)grid-cols-(?!1(?:\s|$))\S+/g) ?? [];
      expect(bare, `${name} sets columns before the first breakpoint`).toEqual([]);
    }
  });

  it("the bar layout is flex, and never a grid", () => {
    expect(rowLayoutClass.bar).toContain("justify-between");
    expect(rowLayoutClass.bar).not.toContain("grid");
  });
});

describe("the shared page gutter", () => {
  /**
   * The nav, the footer and a `full` band sit at exactly this inset, which is
   * what puts the nav logo and a full-bleed hero headline on one axis. If a
   * width token drifts off it, that alignment silently breaks.
   */
  it("is carried by every width token that insets at all", () => {
    for (const [token, value] of Object.entries(widthClass)) {
      if (token === "bleed") continue;
      expect(value, `widthClass.${token}`).toContain(PAGE_GUTTER);
    }
  });

  /**
   * The one deliberate exception. A band whose child must reach the corner of
   * the viewport — the split hero's photograph — cannot do it through a padded
   * parent, so `bleed` carries no inset and its children carry their own.
   */
  it("is deliberately absent from the bleed tier", () => {
    expect(widthClass.bleed).not.toContain("px-");
    expect(widthClass.bleed).not.toContain("max-w-");
  });

  it("leaves the full-bleed tier without a measure", () => {
    expect(widthClass.full).not.toContain("max-w-");
    expect(widthClass.wide).toContain("max-w-");
  });

  it("does not stack a second horizontal padding on top of the gutter", () => {
    for (const [token, value] of Object.entries(widthClass)) {
      const expected = token === "bleed" ? 0 : 2;
      const paddings = value.match(/(?:^|\s)(?:sm:|md:|lg:|xl:)?px-\S+/g) ?? [];
      expect(paddings.length, `widthClass.${token} has ${paddings.length} px-* classes`).toBe(
        expected
      );
    }
  });
});

describe("the band padding scale", () => {
  /** Every `py-*` in a token's string, in breakpoint order. */
  function ramp(token: keyof typeof paddingClass): number[] {
    return (paddingClass[token].match(/py-(\d+)/g) ?? []).map((v) => Number(v.replace("py-", "")));
  }

  const SCALED = ["sm", "md", "lg", "xl", "2xl"] as const;

  /**
   * The scale climbs with the viewport and never the other way.
   *
   * This used to assert that nothing at `lg` and above ever moved — the promise
   * that made adding breakpoints safe for sites already published. That promise
   * has been deliberately broken: the ramp used to reach its largest value at
   * 1024px, which gave a 1280px laptop and a 2560px display the identical 112px
   * band, and the top of each step now lands at `2xl` instead.
   *
   * So what is still assertable is the ramp's SHAPE rather than any frozen
   * width. A step that went backwards at a breakpoint is invisible in a diff
   * and unmistakable on a page.
   */
  it("never gets smaller as the screen gets wider", () => {
    for (const token of SCALED) {
      const steps = ramp(token);
      expect(steps.length, `paddingClass.${token} has no breakpoints`).toBeGreaterThan(1);
      for (let i = 1; i < steps.length; i += 1) {
        expect(
          steps[i],
          `paddingClass.${token} shrinks at breakpoint ${i}`
        ).toBeGreaterThan(steps[i - 1]);
      }
    }
  });

  /**
   * The tokens are a scale, so a band asking for more air has to get more of it
   * at EVERY width — otherwise `xl` and `lg` are the same decision on the screen
   * most churches are actually read on.
   */
  it("keeps each step above the one below it, at every breakpoint", () => {
    for (let i = 1; i < SCALED.length; i += 1) {
      const lower = ramp(SCALED[i - 1]);
      const higher = ramp(SCALED[i]);
      for (let bp = 0; bp < Math.min(lower.length, higher.length); bp += 1) {
        expect(
          higher[bp],
          `paddingClass.${SCALED[i]} is not above ${SCALED[i - 1]} at breakpoint ${bp}`
        ).toBeGreaterThanOrEqual(lower[bp]);
      }
    }
  });

  /**
   * `lib/ai/block-prompt.ts` instructs the editor model "Never set a CONTENT
   * band's padding below `lg`". That only means anything while `lg` is still a
   * generous step rather than, say, the new floor.
   */
  it("keeps `lg` above the tighter steps the editor is told to avoid", () => {
    const base = (t: keyof typeof paddingClass) =>
      Number(paddingClass[t].match(/(?:^|\s)py-(\d+)/)![1]);
    expect(base("lg")).toBeGreaterThan(base("md"));
    expect(base("xl")).toBeGreaterThan(base("lg"));
    expect(base("2xl")).toBeGreaterThan(base("xl"));
  });
});

describe("the mobile viewport unit", () => {
  /**
   * `100vh` on mobile Safari exceeds the visible viewport, so a `min-h-screen`
   * hero pushes its button under the browser chrome.
   */
  it("never uses min-h-screen", () => {
    for (const value of Object.values(minHeightClass)) {
      expect(value).not.toContain("min-h-screen");
    }
    expect(minHeightClass.screen).toContain("min-h-svh");
  });
});

describe("the hero headline", () => {
  it("wraps at a two-line measure rather than running the band's width", () => {
    expect(headingScaleClass.display).toContain("max-w-2xl");
    expect(headingScaleClass.display).toContain("text-balance");
  });
});

describe("overlays are dark enough to carry inverted text", () => {
  it("paints black, not the brand", () => {
    expect(overlayClass.scrim).toContain("black");
    expect(overlayClass.dark).toContain("black");
    expect(overlayClass.none).toBe("");
  });
});

describe("the inverted band", () => {
  /**
   * `bg-site-foreground` is dark only if the church happened to pick a dark
   * `foreground`, and `lib/validation/brand.ts` checks hex format rather than
   * luminance — so a church that chose a pale "Text" colour got a pale band
   * with `text-site-background` (usually white) written across it. The token's
   * name is a promise, and mixing toward black is what keeps it.
   */
  it("is dark whatever ink the church chose", () => {
    expect(backgroundClass.inverted).toContain("black");
    expect(backgroundClass.inverted).not.toContain("bg-site-foreground");
  });

  it("still pairs that ground with the light tone", () => {
    expect(backgroundClass.inverted).toContain("text-site-background");
  });
});
