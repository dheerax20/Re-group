import { describe, expect, it } from "vitest";
import {
  applyDesignPass,
  enforceBlockLegibility,
  DEFAULT_DESIGN_RECIPE,
  type DesignRecipe,
} from "@/lib/site/blocks/design-pass";
import { ART_DIRECTIONS, artDirectionById } from "@/lib/ai/agents/catalog";
import { STOCK_IMAGE_ASPECT } from "@/lib/site/blocks/hero";
import type { BlockNode, PageBlocks } from "@/lib/site/blocks/types";

/**
 * The design pass is where a generated homepage stops being whatever the model
 * happened to return and becomes a designed page. It is the only place that
 * can be relied on for rhythm, for the bands the navigation promises, and for
 * the two defects that made every generated site look the same — so it is the
 * one part of the pipeline worth testing without a provider.
 */

/**
 * A minimal composed page: nav, one content band, a closing band, footer.
 *
 * Deliberately NO band with `id: "hero"` — that id is reserved for the band
 * the design template builds, and every pass here skips it. A fixture that
 * used it would silently be asserting the exemption rather than the rule.
 */
function page(overrides: Partial<{ nav: BlockNode; footer: BlockNode }> = {}): PageBlocks {
  return [
    overrides.nav ?? {
      id: "nav",
      type: "section",
      children: [
        {
          id: "nav-row",
          type: "row",
          columns: 2,
          children: [
            { id: "nav-brand", type: "brandLogo" },
            { id: "nav-links", type: "navLinks" },
          ],
        },
      ],
    },
    {
      id: "welcome",
      type: "section",
      children: [{ id: "welcome-heading", type: "heading", scale: "h2", text: "Sunday at 10" }],
    },
    {
      id: "cta",
      type: "section",
      children: [{ id: "cta-heading", type: "heading", scale: "h2", text: "Come and see" }],
    },
    overrides.footer ?? {
      id: "footer",
      type: "section",
      children: [
        {
          id: "footer-row",
          type: "row",
          columns: 2,
          children: [
            { id: "footer-copyright", type: "copyrightLine" },
            { id: "footer-links", type: "navLinks" },
          ],
        },
      ],
    },
  ];
}

/** Collects every node of a type, at any depth. */
function findAll(blocks: PageBlocks, type: string): BlockNode[] {
  const out: BlockNode[] = [];
  const walk = (nodes: BlockNode[]) => {
    for (const node of nodes) {
      if (node.type === type) out.push(node);
      if ("children" in node && Array.isArray(node.children)) walk(node.children);
    }
  };
  walk(blocks);
  return out;
}

function band(blocks: PageBlocks, id: string): BlockNode {
  const found = blocks.find((node) => node.id === id);
  if (!found) throw new Error(`no band "${id}" in [${blocks.map((b) => b.id).join(", ")}]`);
  return found;
}

describe("the bands the navigation promises", () => {
  /**
   * The composer is told the feature bands are not optional and a small model
   * ships a hero and nothing else anyway. `generateNavigation` still links to
   * /sermons and /events, so the visitor is told the church has sermons and
   * then shown a page that never mentions them.
   */
  it("adds a sermons and an events band when the model omitted them", () => {
    const result = applyDesignPass(page(), {
      features: { sermons: true, events: true },
      churchName: "Hail Mary Community",
    });

    expect(findAll(result, "sermonCollection")).toHaveLength(1);
    expect(findAll(result, "eventCollection")).toHaveLength(1);
  });

  it("adds giving and contact bands too, and only for enabled features", () => {
    const result = applyDesignPass(page(), {
      features: { sermons: true, giving: true, contact: false },
    });

    expect(findAll(result, "sermonCollection")).toHaveLength(1);
    expect(findAll(result, "givingCta")).toHaveLength(1);
    expect(findAll(result, "eventCollection")).toHaveLength(0);
    expect(findAll(result, "contactInfo")).toHaveLength(0);
  });

  it("does not duplicate a band the model already composed", () => {
    const composed = page();
    composed.splice(2, 0, {
      id: "sermons",
      type: "section",
      children: [{ id: "sermon-list", type: "sermonCollection" }],
    });

    const result = applyDesignPass(composed, { features: { sermons: true } });
    expect(findAll(result, "sermonCollection")).toHaveLength(1);
  });

  /**
   * Ministries have no database table, so a synthesized ministries band would
   * be the model inventing programmes a church may not run — on a live public
   * page. It is the one enabled feature that is deliberately never backfilled.
   */
  it("never synthesizes ministries, whose copy has no source but the model", () => {
    const result = applyDesignPass(page(), { features: { ministries: true } });
    expect(findAll(result, "ministryCollection")).toHaveLength(0);
  });

  it("skips the about band when the church supplied no words of its own", () => {
    // A page whose bands are all unnamed narrative-wise, so `ensureRequiredBands`
    // sees no existing welcome/about band and has to decide whether to add one.
    const noNarrative = (): PageBlocks =>
      page().filter((b) => b.id !== "welcome");

    const withStory = applyDesignPass(noNarrative(), {
      features: {},
      story: { mission: "We feed people." },
    });
    const without = applyDesignPass(noNarrative(), { features: {} });

    expect(withStory.some((b) => b.id === "about")).toBe(true);
    expect(without.some((b) => b.id === "about")).toBe(false);
  });

  it("keeps the footer last, so an injected band never lands after it", () => {
    const result = applyDesignPass(page(), {
      features: { sermons: true, events: true, giving: true, contact: true },
    });
    expect(result[result.length - 1].id).toBe("footer");
    expect(result[0].id).toBe("nav");
  });
});

describe("the pinned nav and footer bands", () => {
  /**
   * The regression from the reported screenshots. The composer was told never
   * to set a band's padding below `lg` (`py-20`) and separately required to
   * emit the nav AS a band — so an obedient model wrapped a 32px logo in 160px
   * of vertical padding, and the rhythm loop skipped pinned bands and left it
   * there.
   */
  it("strips band padding the model put on the nav", () => {
    const composed = page({
      nav: {
        id: "nav",
        type: "section",
        style: { padding: "lg", background: "surface" },
        children: [
          {
            id: "nav-row",
            type: "row",
            columns: 2,
            children: [
              { id: "nav-brand", type: "brandLogo" },
              { id: "nav-links", type: "navLinks" },
            ],
          },
        ],
      },
    });

    const nav = band(applyDesignPass(composed, {}), "nav");
    expect(nav.style?.padding).toBeUndefined();
    // A background the model chose is still its choice; only spacing is taken.
    expect(nav.style?.background).toBe("surface");
  });

  /**
   * The other half of the same screenshot. A `row` defaults to an equal-column
   * grid, so a two-child nav put the links at 50% of the container with a
   * screen's worth of dead space to their right.
   */
  it("makes the nav and footer rows split bars, not equal-column grids", () => {
    const result = applyDesignPass(page(), {});
    const navRow = findAll([band(result, "nav")], "row")[0];
    const footerRow = findAll([band(result, "footer")], "row")[0];

    expect(navRow).toMatchObject({ layout: "bar" });
    expect(footerRow).toMatchObject({ layout: "bar" });
  });

  it("leaves the pinned bands out of the rhythm rotation", () => {
    const result = applyDesignPass(page(), {});
    // The first content band takes the rotation's opening padding; the nav
    // takes none at all.
    expect(band(result, "nav").style?.background).toBeUndefined();
    expect(band(result, "welcome").style?.padding).toBe(DEFAULT_DESIGN_RECIPE.bandPadding.hero);
  });

  it("keeps whatever else the composer put in the nav", () => {
    const composed = page({
      nav: {
        id: "nav",
        type: "section",
        children: [
          {
            id: "nav-row",
            type: "row",
            children: [
              { id: "nav-brand", type: "brandLogo" },
              { id: "nav-links", type: "navLinks" },
              { id: "nav-cta", type: "button", label: "Plan Your Visit", href: "/contact" },
            ],
          },
        ],
      },
    });

    const nav = band(applyDesignPass(composed, {}), "nav");
    expect(findAll([nav], "button")).toHaveLength(1);
  });
});

describe("eyebrows", () => {
  function withEyebrows(): PageBlocks {
    const composed = page();
    for (const id of ["welcome", "cta"]) {
      const target = composed.find((b) => b.id === id) as { children: BlockNode[] };
      target.children.unshift({ id: `${id}-eyebrow`, type: "eyebrow", text: "Welcome" });
    }
    return composed;
  }

  const recipe = (eyebrows: DesignRecipe["eyebrows"]): DesignRecipe => ({
    ...DEFAULT_DESIGN_RECIPE,
    eyebrows,
  });

  it("keeps at most one under hero-only", () => {
    const result = applyDesignPass(withEyebrows(), {}, recipe("hero-only"));
    expect(findAll(result, "eyebrow")).toHaveLength(1);
  });

  it("keeps none under none", () => {
    const result = applyDesignPass(withEyebrows(), {}, recipe("none"));
    expect(findAll(result, "eyebrow")).toHaveLength(0);
  });

  it("does not leave an emptied container behind", () => {
    const composed = page();
    (composed[1] as { children: BlockNode[] }).children = [
      {
        id: "welcome-stack",
        type: "stack",
        children: [{ id: "welcome-eyebrow", type: "eyebrow", text: "Welcome" }],
      },
    ];

    const result = applyDesignPass(composed, {}, recipe("none"));
    expect(findAll(result, "stack")).toHaveLength(0);
  });

  /** A band whose title is a heading survives; only the decorative label goes. */
  it("never touches headings", () => {
    const result = applyDesignPass(withEyebrows(), {}, recipe("none"));
    expect(findAll(result, "heading").length).toBeGreaterThanOrEqual(2);
  });
});

describe("design templates", () => {
  /**
   * The whole point of the templates. Before them the pass applied one
   * hardcoded rotation, one padding ramp and one centred-hero rule to every
   * church on the platform, so regenerating produced the same page with
   * different words.
   */
  it("gives two templates visibly different pages from the same input", () => {
    const cinematic = artDirectionById("cinematic")!;
    const minimal = artDirectionById("modern-minimal")!;
    const ctx = { features: { sermons: true, events: true } };

    const a = applyDesignPass(page(), ctx, cinematic.recipe);
    const b = applyDesignPass(page(), ctx, minimal.recipe);

    const rhythm = (blocks: PageBlocks) =>
      blocks.filter((n) => n.id !== "nav" && n.id !== "footer").map((n) => n.style?.background);
    const alignment = (blocks: PageBlocks) =>
      blocks.filter((n) => n.id !== "nav" && n.id !== "footer").map((n) => n.style?.align);

    expect(rhythm(a)).not.toEqual(rhythm(b));
    expect(alignment(a)).not.toEqual(alignment(b));
    expect(findAll(a, "sermonCollection")[0]).toMatchObject({ layout: cinematic.recipe.sermons });
    expect(findAll(b, "sermonCollection")[0]).toMatchObject({ layout: minimal.recipe.sermons });
  });

  it("applies the template's collection layouts over whatever the model picked", () => {
    const composed = page();
    composed.splice(2, 0, {
      id: "sermons",
      type: "section",
      children: [{ id: "sermon-list", type: "sermonCollection", layout: "featured" }],
    });

    const minimal = artDirectionById("modern-minimal")!;
    const result = applyDesignPass(composed, { features: { sermons: true } }, minimal.recipe);
    expect(findAll(result, "sermonCollection")[0]).toMatchObject({ layout: "list" });
  });

  /** The rhythm a direction's rotation actually resolves to over a long page. */
  function sequenceFor(recipe: DesignRecipe): Array<string | undefined> {
    const result = applyDesignPass(
      page(),
      { features: { sermons: true, events: true, giving: true, contact: true } },
      recipe
    );
    return result
      .filter((n) => n.id !== "nav" && n.id !== "footer")
      .map((n) => n.style?.background);
  }

  it("never puts two identical backgrounds back to back", () => {
    for (const direction of ART_DIRECTIONS) {
      // ...unless the direction asked to keep its repeats. See the next test.
      if (direction.recipe.allowRepeatBands) continue;

      const backgrounds = sequenceFor(direction.recipe);
      for (let i = 1; i < backgrounds.length; i += 1) {
        expect(backgrounds[i], `${direction.id} repeated a background`).not.toBe(backgrounds[i - 1]);
      }
    }
  });

  /**
   * The dedup is right for five directions and wrong for the one whose whole
   * identity is a flat page — it used to rewrite `modern-minimal`'s rotation
   * into the same alternation every other direction gets, which is how it and
   * `traditional-reverent` came to paint the byte-identical sequence.
   */
  it("keeps a flat page flat when the direction opted out", () => {
    const minimal = artDirectionById("modern-minimal")!;
    expect(minimal.recipe.allowRepeatBands).toBe(true);

    const backgrounds = sequenceFor(minimal.recipe);
    const repeats = backgrounds.filter((bg, i) => i > 0 && bg === backgrounds[i - 1]);
    expect(repeats.length, "the dedup flattened the flat direction").toBeGreaterThan(0);
  });

  /**
   * The property `pickArtDirection` is trying to buy, and the thing nothing
   * checked: six directions that paint the same rhythm are not six decisions.
   */
  it("gives every direction a rhythm no other direction produces", () => {
    const seen = new Map<string, string>();
    for (const direction of ART_DIRECTIONS) {
      const key = sequenceFor(direction.recipe).join(" ");
      const clash = seen.get(key);
      expect(clash, `${direction.id} paints the same rhythm as ${clash}`).toBeUndefined();
      seen.set(key, direction.id);
    }
  });

  /** `alignPolicy: "left"` means left — not "left unless the model centred everything". */
  it("honours a left-ranged template on every band", () => {
    const community = artDirectionById("community-forward")!;
    expect(community.recipe.alignPolicy).toBe("left");

    const result = applyDesignPass(page(), { features: { sermons: true } }, community.recipe);
    const aligns = result
      .filter((n) => n.id !== "nav" && n.id !== "footer")
      .map((n) => n.style?.align);

    expect(new Set(aligns)).toEqual(new Set(["left"]));
  });

  it("keeps a photo the church uploaded at the shape it was uploaded in", () => {
    const composed = page();
    (composed[1] as { children: BlockNode[] }).children.push({
      id: "welcome-photo",
      type: "image",
      src: "https://example.com/sanctuary.jpg",
      aspect: "portrait",
    });

    const cinematic = artDirectionById("cinematic")!;
    expect(cinematic.recipe.image.aspect).not.toBe("portrait");

    const result = applyDesignPass(composed, {}, cinematic.recipe);
    expect(findAll(result, "image")[0]).toMatchObject({ aspect: "portrait" });
  });
});

describe("a seeded photograph gets the box it was shot for", () => {
  /** Every image the pass ended up putting a real photograph into. */
  function imagesWithSrc(blocks: PageBlocks): Array<{ src: string; aspect?: string }> {
    return findAll(blocks, "image").flatMap((node) =>
      node.type === "image" && node.src ? [{ src: node.src, aspect: node.aspect }] : []
    );
  }

  /** A page whose welcome band has an empty slot for the pass to fill. */
  function pageWithSlot(): PageBlocks {
    const composed = page();
    (composed[1] as { children: BlockNode[] }).children.push({
      id: "welcome-photo",
      type: "image",
    } as BlockNode);
    return composed;
  }

  /**
   * `applyRecipeToLeaves` assigns an aspect while the welcome slot is still
   * EMPTY, so it takes the band default; `seedWelcomeImage` then writes a src
   * and used to leave the box alone. Four of the six directions ended up
   * placing a photograph of one orientation into a box of another, and
   * `object-cover` cropped straight through the subject.
   */
  it("matches the stock set's own orientation in every direction", () => {
    for (const direction of ART_DIRECTIONS) {
      const kind = direction.recipe.welcomeImage;
      if (!kind) continue;

      const result = applyDesignPass(pageWithSlot(), { siteId: "site_1" }, direction.recipe);
      const seeded = imagesWithSrc(result)[0];

      expect(seeded, `${direction.id} seeded nothing`).toBeTruthy();
      expect(seeded, direction.id).toMatchObject({ aspect: STOCK_IMAGE_ASPECT[kind] });
    }
  });

  /**
   * The welcome band must not print the photograph the hero already used.
   *
   * No shipped direction pairs one stock set for both, so this is driven off a
   * hand-built recipe — which is the point: the guard is what stops the next
   * direction added from silently repeating a picture.
   */
  it("never repeats the hero's own photograph", () => {
    const recipe: DesignRecipe = {
      ...DEFAULT_DESIGN_RECIPE,
      // Hero and welcome band drawing from the SAME set — the collision.
      hero: {
        archetype: "stacked",
        image: "widescreen",
        copyWidth: "normal",
        photoWidth: "normal",
        treatment: "rounded",
        aspect: "wide",
      },
      welcomeImage: "widescreen",
    };

    // `ctx.hero`'s presence is what gates hero injection — without it there is
    // no hero photograph for the welcome band to collide with.
    const ctx = { siteId: "site_1", churchName: "Hail Mary", hero: { headline: "Sunday at 10" } };

    const sources = imagesWithSrc(applyDesignPass(pageWithSlot(), ctx, recipe)).map((i) => i.src);

    expect(sources.length, "expected a hero photo and a seeded one").toBeGreaterThan(1);
    expect(new Set(sources).size, "the hero's photo was seeded twice").toBe(sources.length);
  });
});

describe("safety nets that must survive the rework", () => {
  it("strips a text tone that would render as invisible text", () => {
    const blocks = [
      {
        id: "hero",
        type: "section",
        style: { background: "inverted" },
        children: [
          { id: "hero-heading", type: "heading", text: "Welcome", style: { textTone: "default" } },
        ],
      },
    ] as unknown as PageBlocks;

    const result = enforceBlockLegibility(blocks);
    const heading = findAll(result, "heading")[0];
    expect(heading.style?.textTone).toBeUndefined();
  });

  it("keeps at most one empty photo slot", () => {
    const composed = page();
    (composed[1] as { children: BlockNode[] }).children.push(
      { id: "img-1", type: "image" },
      { id: "img-2", type: "image" },
      { id: "img-3", type: "image" }
    );

    const result = applyDesignPass(composed, {});
    expect(findAll(result, "image")).toHaveLength(1);
  });

  /**
   * `scripts/backfill-design-pass.ts` decides whether to write by comparing
   * serialized trees, so the pass has to be idempotent in BYTES, not only in
   * meaning — otherwise it rewrites every site on every run.
   */
  it("is byte-idempotent", () => {
    const ctx = { features: { sermons: true, events: true }, story: { mission: "We feed people." } };
    for (const direction of ART_DIRECTIONS) {
      const once = applyDesignPass(page(), ctx, direction.recipe);
      const twice = applyDesignPass(once, ctx, direction.recipe);
      expect(JSON.stringify(twice), `${direction.id} was not idempotent`).toBe(JSON.stringify(once));
    }
  });

  it("returns an empty page untouched rather than synthesizing one", () => {
    expect(applyDesignPass([], { features: { sermons: true } })).toEqual([]);
  });
});

describe("a dark band is a device, not a pattern", () => {
  /**
   * `inverted` is the one background that carries real weight, and a rotation
   * containing it hits it again every cycle — so a nine-band page gave the
   * "one dark band carries the page" direction two of them.
   *
   * Driven off a hand-built recipe rather than cinematic's, which is what this
   * used to read: no shipped direction commits to `inverted` any anymore (see
   * the test below). The guard in `applyDesignPass` is kept for stored trees
   * that still carry one, so the behaviour still needs cover.
   */
  it("uses inverted at most once, however long the page runs", () => {
    const recipe: DesignRecipe = {
      ...DEFAULT_DESIGN_RECIPE,
      bandRhythm: ["transparent", "inverted", "transparent", "surface"],
    };

    const result = applyDesignPass(
      page(),
      { features: { sermons: true, events: true, giving: true, contact: true } },
      recipe
    );
    const dark = result.filter((n) => n.style?.background === "inverted");

    expect(dark).toHaveLength(1);
  });

  /**
   * The rule that stops this recurring.
   *
   * `backgroundClass.inverted` paints the church's own `foreground`, and
   * `lib/validation/brand.ts` checks that value's hex FORMAT rather than its
   * luminance — so a rotation that commits to `inverted` is betting on a
   * colour nothing validates. Cinematic took that bet and shipped a pale band
   * with white type on it. The hero's overlay archetypes are unaffected: their
   * darkness comes from a real black scrim, not from the palette.
   */
  it("is not reached for on any church's behalf", () => {
    for (const direction of ART_DIRECTIONS) {
      expect(direction.recipe.bandRhythm, direction.id).not.toContain("inverted");
    }
  });

  it("never assigns a dark band on a generated page", () => {
    for (const direction of ART_DIRECTIONS) {
      const result = applyDesignPass(
        page(),
        { features: { sermons: true, events: true, giving: true, contact: true } },
        direction.recipe
      );
      const dark = result.filter((n) => n.style?.background === "inverted");
      expect(dark, direction.id).toHaveLength(0);
    }
  });
});

describe("a photograph under an overlay is a dark surface", () => {
  /**
   * The hero's whole design is white type over a photograph. Reading only
   * `background` here meant the pass saw `transparent`, decided
   * `textTone: "inverted"` was unreadable, stripped it, and rendered the hero
   * dark-on-dark.
   */
  function overlaidHero(overlay: "none" | "scrim" | "dark"): PageBlocks {
    return [
      {
        id: "hero",
        type: "section",
        style: {
          backgroundImage: "https://example.com/sanctuary.jpg",
          overlay,
          background: "transparent",
        },
        children: [
          { id: "hero-heading", type: "heading", text: "Sunday at 10", style: { textTone: "inverted" } },
        ],
      },
    ] as unknown as PageBlocks;
  }

  it("keeps inverted text over a scrim", () => {
    const heading = findAll(enforceBlockLegibility(overlaidHero("scrim")), "heading")[0];
    expect(heading.style?.textTone).toBe("inverted");
  });

  it("keeps inverted text over a flat dark wash", () => {
    const heading = findAll(enforceBlockLegibility(overlaidHero("dark")), "heading")[0];
    expect(heading.style?.textTone).toBe("inverted");
  });

  /**
   * With no wash a photo can be any brightness, so the safe reading is to
   * leave the inherited surface alone rather than promise contrast the image
   * cannot keep.
   */
  it("does not treat an un-overlaid photo as dark", () => {
    const heading = findAll(enforceBlockLegibility(overlaidHero("none")), "heading")[0];
    expect(heading.style?.textTone).toBeUndefined();
  });
});

describe("hero injection", () => {
  const HERO = {
    headline: "A church on the corner of Ashfield and Vine",
    subhead: "Two services every Sunday.",
    ctaLabel: "Plan your visit",
    ctaHref: "/contact" as const,
  };

  it("puts the hero directly after the nav", () => {
    const result = applyDesignPass(page(), { hero: HERO, siteId: "x", churchName: "Test" });
    expect(result.map((b) => b.id).slice(0, 2)).toEqual(["nav", "hero"]);
  });

  /**
   * The composer is told not to emit a hero at all, so this is belt and
   * braces — but a model that ignores that would otherwise leave two bands
   * claiming the id, and the second would be unreachable.
   */
  it("never leaves two bands claiming the hero id", () => {
    const composed = page();
    composed.splice(1, 0, {
      id: "hero",
      type: "section",
      children: [{ id: "stray", type: "heading", text: "Model-built hero" }],
    });

    const result = applyDesignPass(composed, { hero: HERO, siteId: "x", churchName: "Test" });
    expect(result.filter((b) => b.id === "hero")).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("Model-built hero");
  });

  /**
   * `scripts/backfill-design-pass.ts` re-runs this over stored sites. A page
   * built before heroes existed has no copy object, and grafting one on would
   * put a photograph and a headline nobody approved onto a live homepage.
   */
  it("adds nothing to a page built before heroes existed", () => {
    const result = applyDesignPass(page(), { features: { sermons: true } });
    expect(result.some((b) => b.id === "hero")).toBe(false);
  });

  it("leaves the hero out of the band rhythm entirely", () => {
    const cinematic = artDirectionById("cinematic")!;
    const result = applyDesignPass(
      page(),
      { hero: HERO, siteId: "x", churchName: "Test" },
      cinematic.recipe
    );
    const hero = band(result, "hero");

    // Its own template values, not the rotation's.
    expect(hero.style?.backgroundImage).toBeTruthy();
    expect(hero.style?.overlay).toBe("scrim");
    expect(hero.style?.minHeight).toBe("hero");
    // And the first CONTENT band still opens the rotation.
    expect(band(result, "welcome").style?.background).toBe(cinematic.recipe.bandRhythm[0]);
  });

  it("keeps one display heading, and gives it to the hero", () => {
    const composed = page();
    (composed[2] as { children: BlockNode[] }).children = [
      { id: "cta-heading", type: "heading", scale: "display", text: "Also loud" },
    ];

    const result = applyDesignPass(composed, { hero: HERO, siteId: "x", churchName: "Test" });
    const display = findAll(result, "heading").filter(
      (n) => n.type === "heading" && n.scale === "display"
    );

    expect(display).toHaveLength(1);
    expect(display[0].id).toBe("hero-headline");
  });

  it("stays byte-idempotent with a hero in play", () => {
    const ctx = { hero: HERO, siteId: "x", churchName: "Test", features: { sermons: true } };
    for (const direction of ART_DIRECTIONS) {
      const once = applyDesignPass(page(), ctx, direction.recipe);
      const twice = applyDesignPass(once, ctx, direction.recipe);
      expect(JSON.stringify(twice), `${direction.id} was not idempotent`).toBe(JSON.stringify(once));
    }
  });
});
