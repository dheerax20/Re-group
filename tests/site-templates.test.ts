import { describe, expect, it } from "vitest";
import {
  SITE_TEMPLATES,
  isSiteTemplateId,
  siteTemplateById,
  type SiteTemplate,
  type TemplateProfile,
} from "@/lib/site/templates";
import { resolveTemplateCopy } from "@/lib/site/templates/copy";
import { coerceBlocks } from "@/lib/site/blocks/schema";
import { isStockImage } from "@/lib/site/blocks/hero";
import { FOOTER_BLOCK_ID, HERO_BLOCK_ID, NAV_BLOCK_ID } from "@/lib/site/blocks/types";
import type { BlockNode, PageBlocks } from "@/lib/site/blocks/types";
import { defaultBrandConfig } from "@/lib/validation/brand";
import { defaultFeatures, type FeatureConfig } from "@/lib/features/types";
import { validateSiteForPublish } from "@/lib/site/publish-validation";
import type { SiteConfig } from "@/lib/site/types";

/**
 * The three hand-built templates.
 *
 * These replace an AI build, so they carry the guarantees a build carried and
 * nothing gets to check them afterwards: no model repairs their output, no
 * reviewer reads the page before a church publishes it. The assertions below
 * are the whole safety net.
 *
 * The hardest case is not the church that filled everything in — it is the one
 * that typed a name and clicked through, which is why `BARE` exists.
 */

const FULL_STORY = {
  city: "Ashfield",
  worshipStyle: "Contemporary",
  serviceTimes: "Sundays at 9am and 11am.",
  pastorName: "Rev. Marta Oyelaran",
  mission: "We exist to know God and to make him known on our own street. Everything else follows from that.",
  values: "Hospitality, honesty, and showing up for each other.",
};

function profile(overrides: Partial<TemplateProfile> = {}): TemplateProfile {
  return {
    siteId: "site_test_1",
    churchName: "Hail Mary Community",
    tagline: "A church on the corner of Ashfield and Vine",
    denomination: "Anglican",
    story: FULL_STORY,
    features: { ...defaultFeatures, giving: true, ministries: true },
    brand: defaultBrandConfig as TemplateProfile["brand"],
    ...overrides,
  };
}

/** Everything optional left blank — the church that clicked straight through. */
const BARE = profile({
  tagline: undefined,
  denomination: undefined,
  story: {},
  features: { ...defaultFeatures },
});

/** Every optional feature switched off. */
const FEATURES_OFF: FeatureConfig = {
  ...defaultFeatures,
  sermons: false,
  events: false,
  giving: false,
  ministries: false,
  contact: false,
};

const EDITABLE_PATHS = ["/about", "/contact", "/giving", "/ministries"];

function walk(nodes: PageBlocks, visit: (node: BlockNode) => void): void {
  for (const node of nodes) {
    visit(node);
    if ("children" in node && Array.isArray(node.children)) walk(node.children, visit);
  }
}

function typesIn(nodes: PageBlocks): Set<string> {
  const found = new Set<string>();
  walk(nodes, (node) => found.add(node.type));
  return found;
}

function idsIn(nodes: PageBlocks): string[] {
  const found: string[] = [];
  walk(nodes, (node) => found.push(node.id));
  return found;
}

describe("the registry", () => {
  it("holds every template, each with a distinct id and name", () => {
    // Asserted against the array's own length rather than a literal, so adding
    // a template does not fail a test whose subject is uniqueness.
    expect(SITE_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    expect(new Set(SITE_TEMPLATES.map((t) => t.id)).size).toBe(SITE_TEMPLATES.length);
    expect(new Set(SITE_TEMPLATES.map((t) => t.name)).size).toBe(SITE_TEMPLATES.length);
  });

  it("resolves an id and rejects anything else", () => {
    expect(isSiteTemplateId("cinematic")).toBe(true);
    expect(isSiteTemplateId("ai-generated")).toBe(false);
    expect(isSiteTemplateId(undefined)).toBe(false);
    expect(siteTemplateById("warm-editorial")?.name).toBe("Warm Editorial");
    expect(siteTemplateById("nope")).toBeUndefined();
  });
});

describe.each(SITE_TEMPLATES.map((t) => [t.name, t] as const))("%s", (_name, template: SiteTemplate) => {
  const home = template.buildHome(profile());
  const bare = template.buildHome(BARE);

  it("opens with nav, then the hero, and ends with the footer", () => {
    expect(home[0].id).toBe(NAV_BLOCK_ID);
    expect(home[1].id).toBe(HERO_BLOCK_ID);
    expect(home[home.length - 1].id).toBe(FOOTER_BLOCK_ID);
  });

  it("gives the hero a stock photograph without a model", () => {
    const hero = home.find((node) => node.id === HERO_BLOCK_ID);
    expect(hero).toBeDefined();

    // Archetype A paints it as the band's background; B and C hold an <img>.
    const fromBackground = hero?.style?.backgroundImage;
    let fromChild: string | undefined;
    walk([hero as BlockNode], (node) => {
      if (node.type === "image" && node.src && !fromChild) fromChild = node.src;
    });

    expect(isStockImage(fromBackground ?? fromChild)).toBe(true);
  });

  /**
   * The standing requirement on this feature: a church whose nav links to
   * /sermons and /events must not land on a homepage that mentions neither.
   */
  it("always carries sermons and events when those features are on", () => {
    const types = typesIn(home);
    expect(types.has("sermonCollection")).toBe(true);
    expect(types.has("eventCollection")).toBe(true);
    expect(types.has("givingCta")).toBe(true);
    expect(types.has("contactInfo")).toBe(true);
  });

  it("carries none of them when the features are off", () => {
    const types = typesIn(template.buildHome(profile({ features: FEATURES_OFF })));
    expect(types.has("sermonCollection")).toBe(false);
    expect(types.has("eventCollection")).toBe(false);
    expect(types.has("givingCta")).toBe(false);
    expect(types.has("contactInfo")).toBe(false);
  });

  it("survives the repair pass unchanged", () => {
    // Anything a template emits that `coerceBlocks` strips is a token the
    // renderer will never see — a silent, invisible failure in production.
    expect(coerceBlocks(home)).toEqual(home);
    expect(coerceBlocks(bare)).toEqual(bare);
  });

  it("uses each block id once", () => {
    const ids = idsIn(home);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never renders a heading or paragraph with nothing in it", () => {
    for (const page of [home, bare]) {
      walk(page, (node) => {
        if (node.type === "heading" || node.type === "text") {
          expect(node.text.trim(), `${node.id} is empty`).not.toBe("");
        }
      });
    }
  });

  /**
   * The church that filled in nothing is the one most likely to publish
   * without reading, so it gets the same finished page as everyone else.
   */
  it("builds a complete page from a name alone", () => {
    expect(bare[1].id).toBe(HERO_BLOCK_ID);
    expect(typesIn(bare).has("sermonCollection")).toBe(true);

    const headings: string[] = [];
    walk(bare, (node) => {
      if (node.type === "heading") headings.push(node.text);
    });
    expect(headings.length).toBeGreaterThan(3);
    expect(headings.some((text) => text.includes("undefined"))).toBe(false);
  });

  it("builds every editable secondary page, and no others", () => {
    for (const path of EDITABLE_PATHS) {
      const page = template.buildPage(path, profile());
      expect(page, `${path} is empty`).toBeTruthy();
      expect((page as PageBlocks).length).toBeGreaterThan(0);
    }
    expect(template.buildPage("/", profile())).toBeNull();
    expect(template.buildPage("/sermons", profile())).toBeNull();
  });

  it("keeps nav and footer off the secondary pages", () => {
    // The public layout renders those once from `site.blocks`; a second copy
    // on `/about` would print two navbars.
    for (const path of EDITABLE_PATHS) {
      const ids = idsIn(template.buildPage(path, profile()) ?? []);
      expect(ids).not.toContain(NAV_BLOCK_ID);
      expect(ids).not.toContain(FOOTER_BLOCK_ID);
    }
  });

  it("does not grow a hero or a feature band on a secondary page", () => {
    const contact = template.buildPage("/contact", profile()) ?? [];
    expect(idsIn(contact)).not.toContain(HERO_BLOCK_ID);
    expect(typesIn(contact).has("sermonCollection")).toBe(false);
  });

  it("leaves styling entirely to the recipe", () => {
    // The bands a template authors carry no style of their own; every padding,
    // background and alignment on the finished page was assigned by
    // `applyDesignPass`. This asserts the pass actually ran.
    const body = home.filter(
      (node) => node.id !== NAV_BLOCK_ID && node.id !== FOOTER_BLOCK_ID
    );
    for (const node of body) {
      expect(node.style?.padding, `${node.id} has no padding`).toBeTruthy();
    }
  });
});

describe("the shared copy fallbacks", () => {
  it("prefers the church's own words", () => {
    const copy = resolveTemplateCopy(profile());
    expect(copy.hero.headline).toBe("A church on the corner of Ashfield and Vine");
    expect(copy.aboutBody).toBe(FULL_STORY.mission);
    expect(copy.visitBody).toBe(FULL_STORY.serviceTimes);
    expect(copy.valuesBody).toBe(FULL_STORY.values);
  });

  it("falls back to the church name, never to an empty string", () => {
    const copy = resolveTemplateCopy(BARE);
    expect(copy.hero.headline).toBe("Hail Mary Community");
    for (const value of [
      copy.hero.subhead,
      copy.hero.ctaLabel,
      copy.aboutBody,
      copy.visitBody,
      copy.closingBody,
      copy.givingBody,
      copy.contactBody,
      copy.ministriesBody,
      copy.seoDescription,
    ]) {
      expect(value.trim()).not.toBe("");
      expect(value).not.toContain("undefined");
    }
    // Values are the one slot allowed to be absent — a band is dropped rather
    // than filled with a claim about what this church believes.
    expect(copy.valuesBody).toBeUndefined();
  });

  it("sends the hero button somewhere the site actually has", () => {
    expect(resolveTemplateCopy(profile()).hero.ctaHref).toBe("/contact");
    expect(
      resolveTemplateCopy(profile({ features: { ...defaultFeatures, contact: false } })).hero
        .ctaHref
    ).toBe("/about");
  });
});

describe("switching template changes the photograph", () => {
  it("avoids the picture the previous design used", () => {
    const first = SITE_TEMPLATES[0].buildHome(profile());
    const hero = first.find((node) => node.id === HERO_BLOCK_ID);
    let used = hero?.style?.backgroundImage;
    walk([hero as BlockNode], (node) => {
      if (node.type === "image" && node.src && !used) used = node.src;
    });
    expect(used).toBeTruthy();

    const again = SITE_TEMPLATES[0].buildHome(profile({ previousHeroImage: used }));
    const heroAgain = again.find((node) => node.id === HERO_BLOCK_ID);
    let next = heroAgain?.style?.backgroundImage;
    walk([heroAgain as BlockNode], (node) => {
      if (node.type === "image" && node.src && !next) next = node.src;
    });

    expect(next).toBeTruthy();
    expect(next).not.toBe(used);
  });
});

describe("the publish gate", () => {
  /**
   * It used to demand `templateId === "ai-generated"` and reject everything
   * else as predating the builder, which would have made every
   * template-designed site unpublishable.
   */
  function publishable(templateId: string) {
    const site = {
      site: { name: "Hail Mary Community", slug: "hail-mary" },
      brand: {
        ...defaultBrandConfig,
        logo: { url: "https://example.org/logo.png", alt: "" },
      },
      features: defaultFeatures,
      template: { id: templateId, version: 1 },
      navigation: [{ label: "Home", href: "/" }],
      sections: [],
    } as unknown as SiteConfig;

    return validateSiteForPublish(site).errors.filter((e) => e.field === "template.id");
  }

  it("accepts a site designed by any of the three templates", () => {
    for (const template of SITE_TEMPLATES) {
      expect(publishable(template.id), template.id).toEqual([]);
    }
  });

  it("still accepts an AI build", () => {
    expect(publishable("ai-generated")).toEqual([]);
  });

  it("still refuses a draft that never chose a design", () => {
    expect(publishable("unset")).toHaveLength(1);
  });
});
