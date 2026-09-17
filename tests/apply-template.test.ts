import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBrandConfig } from "@/lib/validation/brand";
import { defaultFeatures } from "@/lib/features/types";
import { pickHeroImage } from "@/lib/site/blocks/hero";
import { cinematicTemplate } from "@/lib/site/templates/cinematic";

/** What Cinematic's hero would pick for this site with nothing to avoid. */
const NATURAL_PICK = pickHeroImage("overlay", "site_1");

/**
 * Applying a pre-built template.
 *
 * This is the mirror of `commitBuild`, and what it must NOT do is as load
 * bearing as what it does: no `SiteGenerationJob` row (that table is the AI
 * ledger, so a row spends one of the church's monthly builds) and no budget
 * call. Those are asserted as negatives below, because nothing downstream
 * would notice a church being quietly charged for a free action.
 *
 * The other guarantee under test is the storyConfig merge. That column is a
 * flat bag shared by the six church-story keys and the design sidecars, so a
 * write that replaces it loses the church's own words.
 */
const site = { findUnique: vi.fn(), update: vi.fn() };
const sitePage = { deleteMany: vi.fn(), create: vi.fn() };
const siteGenerationJob = { create: vi.fn(), update: vi.fn(), createManyAndReturn: vi.fn() };
const $transaction = vi.fn(async (ops: unknown[]) => ops);

vi.mock("@/lib/db", () => ({
  prisma: { site, sitePage, siteGenerationJob, $transaction },
  withDbRetry: (fn: () => unknown) => fn(),
}));

const invalidateSite = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/site/invalidate", () => ({
  invalidateSite: (...args: unknown[]) => invalidateSite(...args),
}));

const { applyTemplateToSite } = await import("@/lib/site/templates/apply");

const STORY = {
  city: "Ashfield",
  serviceTimes: "Sundays at 9am and 11am.",
  mission: "We exist to know God and to make him known on our own street.",
  values: "Hospitality and honesty.",
  // A sidecar from a previous AI build. Must survive.
  agentLog: [{ agent: "composer", role: "Composer", summary: "wrote a page" }],
  improvements: [{ title: "Add a photo", detail: "…", action: "upload_hero_photo" }],
  heroImageUrl: NATURAL_PICK,
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "site_1",
    name: "Hail Mary Community",
    slug: "hail-mary",
    status: "DRAFT",
    tagline: "A church on the corner of Ashfield and Vine",
    denomination: "Anglican",
    congregationSize: 120,
    primaryContactEmail: "hello@hailmary.org",
    primaryContactPhone: null,
    primaryContactName: null,
    brandConfig: defaultBrandConfig,
    featureConfig: { ...defaultFeatures, giving: true },
    navigationConfig: [{ label: "Start here", href: "/" }],
    sectionConfig: [],
    blockConfig: null,
    seoConfig: { title: "", description: "" },
    storyConfig: STORY,
    templateId: "ai-generated",
    templateVersion: 1,
    socialLinks: [],
    pages: [],
    ...overrides,
  };
}

/** The `data` handed to `site.update` in the transaction. */
function updateData() {
  return site.update.mock.calls[0][0].data as Record<string, never>;
}

beforeEach(() => {
  vi.clearAllMocks();
  site.findUnique.mockResolvedValue(row());
});

describe("applyTemplateToSite", () => {
  it("writes the template's id and version, and its name as the style", async () => {
    const result = await applyTemplateToSite("site_1", "cinematic");

    expect(result.styleName).toBe("Cinematic");
    const data = updateData();
    expect(data.templateId).toBe("cinematic");
    /**
     * Read off the template rather than hardcoded. What is under test is that
     * the version is carried through to the row at all — a literal here fails
     * on every legitimate bump, which is the opposite of what it should do,
     * and is exactly what happened when cinematic went to 2.
     */
    expect(data.templateVersion).toBe(cinematicTemplate.version);
    expect((data.storyConfig as Record<string, unknown>).styleName).toBe("Cinematic");
  });

  it("stores the navbar treatment rather than leaving it to be re-derived", async () => {
    // Re-derived from the direction table, a later edit to that table would
    // restyle every live site sharing the name. Same reasoning as a build's.
    await applyTemplateToSite("site_1", "warm-editorial");
    expect((updateData().storyConfig as Record<string, unknown>).navVariant).toBe("solid");
  });

  it("keeps the church's own story keys and clears the old design's feedback", async () => {
    await applyTemplateToSite("site_1", "traditional");
    const story = updateData().storyConfig as Record<string, unknown>;

    expect(story.mission).toBe(STORY.mission);
    expect(story.city).toBe("Ashfield");
    expect(story.serviceTimes).toBe(STORY.serviceTimes);
    // The lists describe a design this site no longer has.
    expect(story.improvements).toEqual([]);
    expect(story.agentLog).toEqual([]);
  });

  it("writes a homepage and one row per editable page", async () => {
    await applyTemplateToSite("site_1", "cinematic");

    expect(Array.isArray(updateData().blockConfig)).toBe(true);
    const paths = sitePage.create.mock.calls.map((call) => call[0].data.path);
    // `giving` is on and `ministries` is off in the fixture.
    expect(paths).toContain("/about");
    expect(paths).toContain("/contact");
    expect(paths).toContain("/giving");
    expect(paths).not.toContain("/ministries");
    expect(paths).not.toContain("/");
  });

  it("replaces every stored page rather than merging into them", async () => {
    await applyTemplateToSite("site_1", "cinematic");
    expect(sitePage.deleteMany).toHaveBeenCalledWith({ where: { siteId: "site_1" } });
  });

  it("costs nothing — no job row, and so no AI budget", async () => {
    await applyTemplateToSite("site_1", "cinematic");
    expect(siteGenerationJob.create).not.toHaveBeenCalled();
    expect(siteGenerationJob.createManyAndReturn).not.toHaveBeenCalled();
  });

  it("keeps the church's navigation labels", async () => {
    await applyTemplateToSite("site_1", "cinematic");
    const nav = updateData().navigationConfig as Array<{ href: string; label: string }>;
    // `mergeNavigation` keeps a label the church renamed and still forces Home
    // first; a template must not reset either.
    expect(nav[0]).toEqual({ href: "/", label: "Start here" });
    expect(nav.some((item) => item.href === "/giving")).toBe(true);
  });

  it("clears the site's caches once, for the right slug", async () => {
    await applyTemplateToSite("site_1", "cinematic");
    expect(invalidateSite).toHaveBeenCalledTimes(1);
    expect(invalidateSite).toHaveBeenCalledWith("site_1", { slug: "hail-mary" });
  });

  it("keeps the photograph when re-applying the same template", async () => {
    // Re-applying is how a church picks up a change to their own details.
    // Having the picture move at the same time would read as a second bug.
    site.findUnique.mockResolvedValue(row({ templateId: "cinematic" }));
    await applyTemplateToSite("site_1", "cinematic");

    expect((updateData().storyConfig as Record<string, unknown>).heroImageUrl).toBe(
      NATURAL_PICK
    );
  });

  it("changes the photograph when switching template", async () => {
    // Otherwise a redesign reads as the same site in a different frame.
    site.findUnique.mockResolvedValue(row({ templateId: "traditional" }));
    await applyTemplateToSite("site_1", "cinematic");

    const next = (updateData().storyConfig as Record<string, unknown>).heroImageUrl;
    expect(next).toBeTruthy();
    expect(next).not.toBe(NATURAL_PICK);
  });

  it("refuses a template id that is not in the registry", async () => {
    await expect(
      applyTemplateToSite("site_1", "not-a-template" as never)
    ).rejects.toThrow(/Unknown template/);
    expect(site.update).not.toHaveBeenCalled();
  });

  it("refuses a site that is not there", async () => {
    site.findUnique.mockResolvedValue(null);
    await expect(applyTemplateToSite("nope", "cinematic")).rejects.toThrow(/Site not found/);
  });
});
