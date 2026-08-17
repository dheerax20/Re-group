import { describe, expect, it } from "vitest";
import { coerceSections, sectionConfigSchema } from "@/lib/validation/section";

/**
 * `coerceSections` is the read path: it must repair, never throw, because the
 * alternative is a published church website going down over one bad row.
 * `sectionConfigSchema` is the write path: it must reject.
 */
describe("coerceSections", () => {
  it("survives values that are not arrays", () => {
    expect(coerceSections(null)).toEqual([]);
    expect(coerceSections({})).toEqual([]);
    expect(coerceSections("[]")).toEqual([]);
    expect(coerceSections(undefined)).toEqual([]);
  });

  it("drops rows that are not sections", () => {
    expect(coerceSections([null, "hero", 7, {}])).toEqual([]);
  });

  it("drops unknown section types", () => {
    const result = coerceSections([
      { id: "x", type: "not-a-section", variant: "grid", enabled: true, config: {} },
      { id: "hero", type: "hero", variant: "cinematic", enabled: true, config: {} },
    ]);
    expect(result.map((section) => section.type)).toEqual(["hero"]);
  });

  it("falls back to the first registered layout for an unknown variant", () => {
    const [section] = coerceSections([
      { id: "hero", type: "hero", variant: "invented-by-an-llm", enabled: true, config: {} },
    ]);
    expect(section.variant).toBe("split");
  });

  it("strips an unsafe cta href but keeps the section", () => {
    const [section] = coerceSections([
      {
        id: "hero",
        type: "hero",
        variant: "cinematic",
        enabled: true,
        config: {
          title: "Welcome",
          primaryCta: { label: "Give", href: "javascript:alert(1)" },
        },
      },
    ]);
    expect(section.config.title).toBe("Welcome");
    expect(section.config.primaryCta).toBeUndefined();
  });

  it("strips an unsafe image url but keeps the copy", () => {
    const [section] = coerceSections([
      {
        id: "hero",
        type: "hero",
        variant: "cinematic",
        enabled: true,
        config: { title: "Welcome", imageUrl: "data:text/html,<script>" },
      },
    ]);
    expect(section.config.title).toBe("Welcome");
    expect(section.config.imageUrl).toBeUndefined();
  });

  it("keeps unrecognised config keys, which templates and agents rely on", () => {
    const [section] = coerceSections([
      {
        id: "events",
        type: "events",
        variant: "grid",
        enabled: true,
        config: { columns: 3, showPastEvents: false },
      },
    ]);
    expect(section.config.columns).toBe(3);
    expect(section.config.showPastEvents).toBe(false);
  });

  it("treats a missing enabled flag as enabled", () => {
    const [section] = coerceSections([
      { id: "footer", type: "footer", variant: "standard", config: {} },
    ]);
    expect(section.enabled).toBe(true);
  });
});

describe("sectionConfigSchema", () => {
  const valid = [
    {
      id: "hero",
      type: "hero" as const,
      variant: "cinematic",
      enabled: true,
      config: { title: "Welcome", primaryCta: { label: "Visit", href: "/contact" } },
    },
  ];

  it("accepts a well-formed section list", () => {
    expect(sectionConfigSchema.parse(valid)).toHaveLength(1);
  });

  it("rejects a variant that no component implements", () => {
    const result = sectionConfigSchema.safeParse([
      { ...valid[0], variant: "hologram" },
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects an unsafe cta href on write", () => {
    const result = sectionConfigSchema.safeParse([
      {
        ...valid[0],
        config: { primaryCta: { label: "Give", href: "javascript:alert(1)" } },
      },
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects an unknown section type on write", () => {
    const result = sectionConfigSchema.safeParse([{ ...valid[0], type: "banner" }]);
    expect(result.success).toBe(false);
  });
});
