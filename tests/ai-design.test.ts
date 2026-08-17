import { describe, expect, it } from "vitest";
import {
  ART_DIRECTIONS,
  artDirectionByName,
  pickArtDirection,
} from "@/lib/ai/agents/catalog";
import { assembleGeneratedSite } from "@/lib/ai/agents/assemble";
import { defaultFeatures } from "@/lib/features/types";
import type { SiteGenerationInput } from "@/lib/ai/types";
import type { LayoutPlan } from "@/lib/ai/agents/schemas";

/**
 * This is the regression suite for "the AI generates the same layout every
 * time." The bug had two causes: a system prompt that told every build to
 * prefer one look, and a code-level lock (`aestheticVariant`) that quietly
 * rewrote anything else back to that look regardless of what the model or the
 * church's own church-specific plan said. These tests pin down the fix at the
 * code level, independent of what any LLM actually returns.
 */

function baseInput(overrides: Partial<SiteGenerationInput> = {}): SiteGenerationInput {
  return {
    churchName: "Grace Community Church",
    features: defaultFeatures,
    templateId: "ai-generated",
    brand: {
      colors: {
        primary: "#1E3A5F",
        secondary: "#D4AF37",
        background: "#FFFFFF",
        foreground: "#111827",
        accent: "#D4AF37",
      },
      typography: { primaryFont: "inter", secondaryFont: "playfair-display" },
      logo: { url: "", alt: "" },
      favicon: { url: "" },
    },
    ...overrides,
  };
}

describe("ART_DIRECTIONS", () => {
  it("only uses variants that are actually registered components", async () => {
    const { sectionVariantOptions } = await import("@/lib/site/section-variants");
    for (const direction of ART_DIRECTIONS) {
      expect(sectionVariantOptions.navbar).toContain(direction.navbar);
      expect(sectionVariantOptions.hero).toContain(direction.hero);
      expect(sectionVariantOptions.welcome).toContain(direction.welcome);
      expect(sectionVariantOptions.about).toContain(direction.about);
      expect(sectionVariantOptions.sermons).toContain(direction.sermons);
      expect(sectionVariantOptions.events).toContain(direction.events);
    }
  });

  it("never pairs a transparent navbar with a hero that isn't full-bleed", () => {
    // The one real legibility rule the old lock enforced — every curated
    // direction has to satisfy it by construction, not by a runtime patch.
    const fullBleed = new Set(["split", "fullscreen", "cinematic"]);
    for (const direction of ART_DIRECTIONS) {
      if (direction.navbar === "transparent") {
        expect(fullBleed.has(direction.hero)).toBe(true);
      }
    }
  });

  it("has more than one direction, or there is nothing to vary", () => {
    expect(ART_DIRECTIONS.length).toBeGreaterThan(1);
  });
});

describe("pickArtDirection", () => {
  it("avoids the given id when other options exist", () => {
    const first = ART_DIRECTIONS[0];
    for (let i = 0; i < 25; i += 1) {
      expect(pickArtDirection(first.id).id).not.toBe(first.id);
    }
  });

  it("falls back to the full pool when the id doesn't match anything", () => {
    expect(() => pickArtDirection("not-a-real-direction")).not.toThrow();
  });

  it("still returns a direction with no argument", () => {
    expect(ART_DIRECTIONS.map((d) => d.id)).toContain(pickArtDirection().id);
  });
});

describe("artDirectionByName", () => {
  it("round-trips a direction's own display name", () => {
    for (const direction of ART_DIRECTIONS) {
      expect(artDirectionByName(direction.name)?.id).toBe(direction.id);
    }
  });

  it("returns undefined for a name that isn't a direction", () => {
    expect(artDirectionByName("Not A Real Style")).toBeUndefined();
  });
});

describe("assembleGeneratedSite — direction locking", () => {
  const direction = ART_DIRECTIONS.find((d) => d.id === "modern-minimal")!;
  const otherDirection = ART_DIRECTIONS.find((d) => d.id === "cinematic")!;

  it("uses the direction's variants even when the model's layout disagrees", () => {
    // The exact bug: the model proposing something and a lock silently
    // overriding it back to one fixed look. Now the override always matches
    // `direction`, and `direction` is what changes between builds.
    const layout: LayoutPlan = {
      rationale: "test",
      sections: [
        { type: "navbar", variant: "transparent" },
        { type: "hero", variant: "cinematic" },
        { type: "welcome", variant: "split" },
        { type: "about", variant: "image-right" },
        { type: "cta", variant: "full-width" },
        { type: "footer", variant: "standard" },
      ],
    };

    const result = assembleGeneratedSite({ input: baseInput(), direction, layout });
    const byType = Object.fromEntries(result.sections.map((s) => [s.type, s.variant]));

    expect(byType.navbar).toBe(direction.navbar);
    expect(byType.hero).toBe(direction.hero);
    expect(byType.welcome).toBe(direction.welcome);
    expect(byType.about).toBe(direction.about);
  });

  it("produces a structurally different site for a different direction, same church", () => {
    const a = assembleGeneratedSite({ input: baseInput(), direction });
    const b = assembleGeneratedSite({ input: baseInput(), direction: otherDirection });

    const heroA = a.sections.find((s) => s.type === "hero")?.variant;
    const heroB = b.sections.find((s) => s.type === "hero")?.variant;
    const navA = a.sections.find((s) => s.type === "navbar")?.variant;
    const navB = b.sections.find((s) => s.type === "navbar")?.variant;

    expect(heroA).not.toBe(heroB);
    expect(navA).not.toBe(navB);
  });

  it("still guarantees navbar, hero, and footer with no layout plan at all", () => {
    const result = assembleGeneratedSite({ input: baseInput(), direction });
    const types = result.sections.map((s) => s.type);
    expect(types[0]).toBe("navbar");
    expect(types).toContain("hero");
    expect(types[types.length - 1]).toBe("footer");
  });

  it("includes only sections whose feature is actually enabled", () => {
    const result = assembleGeneratedSite({
      input: baseInput({
        features: { ...defaultFeatures, giving: false, ministries: false, youtube: false },
      }),
      direction,
    });
    const types = result.sections.map((s) => s.type);
    expect(types).not.toContain("giving");
    expect(types).not.toContain("ministries");
    expect(types).not.toContain("youtube");
  });

  it("writes church-specific copy onto the hero even without an AI copy deck", () => {
    const result = assembleGeneratedSite({
      input: baseInput({ churchName: "Riverside Chapel" }),
      direction,
    });
    const hero = result.sections.find((s) => s.type === "hero");
    expect(JSON.stringify(hero?.config)).toContain("Riverside Chapel");
  });
});
