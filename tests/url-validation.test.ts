import { describe, expect, it } from "vitest";
import {
  isSafeLinkTarget,
  safeLinkTarget,
  safeMediaUrl,
} from "@/lib/validation/url";

/**
 * These are the assertions that stop a section config from putting executable
 * or off-site content into a published church page. If one of them starts
 * failing, the corresponding attack works again.
 */
describe("link targets", () => {
  it("accepts the site's own pages", () => {
    for (const href of ["/", "/about", "/sermons", "/events", "/giving", "/contact"]) {
      expect(isSafeLinkTarget(href)).toBe(true);
    }
  });

  it("accepts detail pages under known collections", () => {
    expect(isSafeLinkTarget("/sermons/hope-for-the-weary")).toBe(true);
    expect(isSafeLinkTarget("/events/christmas-eve-2026")).toBe(true);
  });

  it("accepts https, mailto and tel", () => {
    expect(isSafeLinkTarget("https://example.org/give")).toBe(true);
    expect(isSafeLinkTarget("mailto:pastor@example.org")).toBe(true);
    expect(isSafeLinkTarget("tel:+15551234567")).toBe(true);
  });

  it("rejects script-bearing protocols", () => {
    for (const href of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "  javascript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "vbscript:msgbox(1)",
      "blob:https://example.org/x",
      "file:///etc/passwd",
    ]) {
      expect(isSafeLinkTarget(href), href).toBe(false);
    }
  });

  it("rejects protocol-relative URLs that look internal", () => {
    expect(isSafeLinkTarget("//evil.example")).toBe(false);
  });

  it("rejects plain http, which would downgrade a visitor's connection", () => {
    expect(isSafeLinkTarget("http://example.org")).toBe(false);
  });

  it("rejects internal paths that are not real pages", () => {
    expect(isSafeLinkTarget("/wp-admin")).toBe(false);
    expect(isSafeLinkTarget("/sermons/../../etc")).toBe(false);
  });

  it("falls back rather than rendering an unsafe href", () => {
    expect(safeLinkTarget("javascript:alert(1)", "/contact")).toBe("/contact");
    expect(safeLinkTarget(undefined, "/contact")).toBe("/contact");
    expect(safeLinkTarget(42, "/contact")).toBe("/contact");
    expect(safeLinkTarget("/about", "/contact")).toBe("/about");
  });
});

describe("media URLs", () => {
  it("keeps https images", () => {
    expect(safeMediaUrl("https://cdn.example.org/hero.jpg")).toBe(
      "https://cdn.example.org/hero.jpg"
    );
  });

  it("keeps root-relative asset paths", () => {
    expect(safeMediaUrl("/images/hero.jpg")).toBe("/images/hero.jpg");
  });

  it("drops anything executable or off-protocol", () => {
    expect(safeMediaUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeMediaUrl("data:image/svg+xml,<svg onload=alert(1)>")).toBeUndefined();
    expect(safeMediaUrl("http://cdn.example.org/hero.jpg")).toBeUndefined();
    expect(safeMediaUrl("//cdn.example.org/hero.jpg")).toBeUndefined();
  });

  it("treats empty and non-string values as absent", () => {
    expect(safeMediaUrl("")).toBeUndefined();
    expect(safeMediaUrl(null)).toBeUndefined();
    expect(safeMediaUrl({})).toBeUndefined();
  });
});
