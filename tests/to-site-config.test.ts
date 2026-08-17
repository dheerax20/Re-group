import { describe, expect, it } from "vitest";
import type { Site } from "@prisma/client";
import { toSiteConfig } from "@/lib/site/to-site-config";
import { defaultBrandConfig } from "@/lib/validation/brand";
import { defaultFeatures } from "@/lib/features/types";

/**
 * The sneakiest of the three "always cinematic" locks: this one ran on
 * every READ of every AI-generated site — dashboard, editor, public page —
 * so it would have silently undone a genuinely chosen "centered" hero on
 * every page load, with nothing in the generation logs to explain why.
 */

function siteRow(overrides: Partial<Site> = {}): Site {
  const now = new Date();
  return {
    id: "site_1",
    name: "Grace Community Church",
    slug: "grace-community",
    denomination: null,
    congregationSize: null,
    primaryContactName: null,
    primaryContactEmail: null,
    primaryContactPhone: null,
    tagline: null,
    storyConfig: {},
    status: "DRAFT",
    brandConfig: defaultBrandConfig,
    featureConfig: defaultFeatures,
    navigationConfig: [{ label: "Home", href: "/" }],
    sectionConfig: [],
    seoConfig: { title: "", description: "" },
    templateId: "ai-generated",
    templateVersion: 1,
    userId: null,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    ...overrides,
  } as Site;
}

describe("toSiteConfig — no post-hoc style rewriting", () => {
  it("keeps a centered hero on an ai-generated site instead of rewriting it to cinematic", () => {
    const row = siteRow({
      sectionConfig: [
        { id: "hero", type: "hero", variant: "centered", enabled: true, config: {} },
      ] as never,
    });
    const config = toSiteConfig(row);
    expect(config.sections.find((s) => s.type === "hero")?.variant).toBe("centered");
  });

  it("keeps a centered welcome on an ai-generated site instead of rewriting it to split", () => {
    const row = siteRow({
      sectionConfig: [
        { id: "welcome", type: "welcome", variant: "centered", enabled: true, config: {} },
      ] as never,
    });
    const config = toSiteConfig(row);
    expect(config.sections.find((s) => s.type === "welcome")?.variant).toBe("centered");
  });

  it("does the same for non-ai templateIds, since the rewrite was never template-specific in practice", () => {
    const row = siteRow({
      templateId: "modern-church",
      sectionConfig: [
        { id: "hero", type: "hero", variant: "centered", enabled: true, config: {} },
      ] as never,
    });
    const config = toSiteConfig(row);
    expect(config.sections.find((s) => s.type === "hero")?.variant).toBe("centered");
  });
});
