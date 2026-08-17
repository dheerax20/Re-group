import { describe, expect, it } from "vitest";
import { defaultFeatures, type FeatureConfig } from "@/lib/features/types";
import { allowedHrefs, availableSitePages, mergeNavigation } from "@/lib/site/pages";
import { reservedSlugs, slugSchema, slugify } from "@/lib/validation/slug";

function features(overrides: Partial<FeatureConfig> = {}): FeatureConfig {
  return { ...defaultFeatures, ...overrides };
}

describe("availableSitePages", () => {
  it("always offers home and about", () => {
    const hrefs = availableSitePages(features()).map((page) => page.href);
    expect(hrefs).toContain("/");
    expect(hrefs).toContain("/about");
  });

  it("hides a page whose feature is off", () => {
    const hrefs = allowedHrefs(features({ giving: false, sermons: false }));
    expect(hrefs.has("/giving")).toBe(false);
    expect(hrefs.has("/sermons")).toBe(false);
  });

  it("reveals a page when its feature is turned on", () => {
    expect(allowedHrefs(features({ giving: true })).has("/giving")).toBe(true);
  });
});

describe("mergeNavigation", () => {
  it("keeps the church's own labels and order", () => {
    const result = mergeNavigation(features(), [
      { href: "/", label: "Home" },
      { href: "/about", label: "Our Story" },
    ]);
    expect(result[0]).toEqual({ href: "/", label: "Home" });
    expect(result[1]).toEqual({ href: "/about", label: "Our Story" });
  });

  it("drops links whose feature has since been disabled", () => {
    const result = mergeNavigation(features({ giving: false }), [
      { href: "/", label: "Home" },
      { href: "/giving", label: "Give" },
    ]);
    expect(result.some((item) => item.href === "/giving")).toBe(false);
  });

  it("appends pages unlocked after the navigation was saved", () => {
    const result = mergeNavigation(features({ giving: true }), [
      { href: "/", label: "Home" },
    ]);
    expect(result.some((item) => item.href === "/giving")).toBe(true);
  });

  it("always restores home, which the renderer depends on", () => {
    const result = mergeNavigation(features(), [{ href: "/about", label: "About" }]);
    expect(result[0].href).toBe("/");
  });

  it("removes duplicates rather than rendering the same link twice", () => {
    const result = mergeNavigation(features(), [
      { href: "/", label: "Home" },
      { href: "/about", label: "About" },
      { href: "/about", label: "About again" },
    ]);
    expect(result.filter((item) => item.href === "/about")).toHaveLength(1);
  });

  it("falls back to the catalog label when a church saved a blank one", () => {
    const result = mergeNavigation(features(), [
      { href: "/", label: "Home" },
      { href: "/about", label: "   " },
    ]);
    expect(result.find((item) => item.href === "/about")?.label).toBe("About");
  });
});

describe("slugs", () => {
  it("builds a readable slug from a church name", () => {
    expect(slugify("Grace Community Church")).toBe("grace-community-church");
    expect(slugify("  St. Mary's — Parish!  ")).toBe("st-marys-parish");
  });

  it("caps the slug at four words", () => {
    expect(slugify("First Baptist Church Of Springfield Illinois")).toBe(
      "first-baptist-church-of"
    );
  });

  it("rejects reserved slugs that would shadow a platform route", () => {
    for (const slug of reservedSlugs) {
      expect(slugSchema.safeParse(slug).success, slug).toBe(false);
    }
  });

  it("rejects malformed slugs", () => {
    for (const slug of ["a", "-grace", "grace-", "Grace", "grace church", "grace_church"]) {
      expect(slugSchema.safeParse(slug).success, slug).toBe(false);
    }
  });

  it("accepts a well-formed slug", () => {
    expect(slugSchema.safeParse("grace-community").success).toBe(true);
  });
});
