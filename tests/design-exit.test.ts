import { describe, expect, it } from "vitest";
import { resolveDesignExit } from "@/lib/onboarding/design-exit";

/**
 * The Brand step's fork.
 *
 * Both exits save the brand form before they navigate, which is the fix for the
 * defect this replaced: the AI exit used to be a plain link out of the design
 * picker, so it left the page without submitting and the crew designed against
 * whatever brand had last been persisted. The saving lives in the form; the
 * decision of WHERE to go, and whether the church is allowed to go there yet,
 * lives here so it can be checked without a DOM.
 */
const HREFS = { templateHref: "/builder/publish?siteId=s1", aiHref: "/builder/templates?siteId=s1&mode=ai" };

describe("leaving the brand step", () => {
  it("sends the template exit past the AI step entirely", () => {
    expect(resolveDesignExit({ intent: "template", hasTemplate: true, ...HREFS })).toEqual({
      ok: true,
      href: HREFS.templateHref,
    });
  });

  it("sends the AI exit to the step that generates", () => {
    expect(resolveDesignExit({ intent: "ai", hasTemplate: true, ...HREFS })).toEqual({
      ok: true,
      href: HREFS.aiHref,
    });
  });

  it("refuses the template exit when no template has been applied", () => {
    expect(resolveDesignExit({ intent: "template", hasTemplate: false, ...HREFS })).toEqual({
      ok: false,
      reason: "no-template",
    });
  });

  /**
   * The AI exit does not need a template — choosing to generate one is exactly
   * the case where there isn't one yet. Gating both exits on the same flag is
   * the obvious wrong turn here.
   */
  it("lets the AI exit through with nothing applied", () => {
    expect(resolveDesignExit({ intent: "ai", hasTemplate: false, ...HREFS })).toEqual({
      ok: true,
      href: HREFS.aiHref,
    });
  });

  /**
   * Refused, never silently redirected. A church that clicked "Continue with
   * template" has said what they want, and quietly sending them to a build
   * would spend one of their monthly credits on a misread click.
   */
  it("never falls back to the AI exit when the template one is refused", () => {
    const exit = resolveDesignExit({ intent: "template", hasTemplate: false, ...HREFS });
    expect(exit.ok).toBe(false);
    expect(JSON.stringify(exit)).not.toContain("mode=ai");
  });
});
