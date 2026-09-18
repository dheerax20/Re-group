import { describe, expect, it } from "vitest";
import type { Site } from "@prisma/client";
import { toSiteConfig } from "@/lib/site/to-site-config";

/**
 * The primary contact's name, on the read path.
 *
 * `updateChurchInfo` has written `Site.primaryContactName` since the wizard
 * existed, and `toSiteConfig` never mapped it back — so `ChurchForm` seeded
 * that field with "" and every save wrote the column back to null. Invisible
 * while the form was filled in once and abandoned; silent data loss the moment
 * it became editable from Profile. These assertions are what stop it
 * regressing.
 */
function row(overrides: Partial<Site> = {}): Site {
  return {
    id: "site_1",
    name: "Hail Mary Community",
    slug: "hail-mary",
    primaryContactName: "Pastor Ruth",
    primaryContactEmail: "ruth@hailmary.org",
    primaryContactPhone: "555-0100",
    brandConfig: {},
    featureConfig: {},
    navigationConfig: [],
    seoConfig: {},
    sectionConfig: [],
    blockConfig: [],
    storyConfig: {},
    // Everything else `toSiteConfig` reads is coerced from a Json column and
    // degrades to its default, so the fixture only has to carry what is
    // under test.
    ...overrides,
  } as unknown as Site;
}

describe("toSiteConfig — primary contact", () => {
  it("carries the contact's name through to the config", () => {
    expect(toSiteConfig(row()).contact?.name).toBe("Pastor Ruth");
  });

  it("keeps email and phone alongside it", () => {
    const contact = toSiteConfig(row()).contact;
    expect(contact?.email).toBe("ruth@hailmary.org");
    expect(contact?.phone).toBe("555-0100");
  });

  /**
   * `undefined`, not "". The form falls back with `?? ""` and a stored empty
   * string would be indistinguishable from a name — but the column is nullable
   * and a church that never gave one must not see a blank field treated as
   * data.
   */
  it("reads an unset name as undefined rather than an empty string", () => {
    const contact = toSiteConfig(row({ primaryContactName: null })).contact;
    expect(contact?.name).toBeUndefined();
  });
});
