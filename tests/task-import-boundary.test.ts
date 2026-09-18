import { describe, expect, it } from "vitest";

/**
 * Background tasks must not depend on the Next.js build pipeline.
 *
 * `next/font` is a build-time transform: `Inter({ … })` is rewritten during a
 * Next compilation and is not a real function anywhere else. A Trigger.dev
 * task is bundled by esbuild, so anything it imports transitively — however
 * far down — has to survive outside Next.
 *
 * This is easy to break by accident and expensive to discover: it fails only
 * once the task actually runs in production, as "Inter is not a function" in
 * a job log, with nothing about the change that caused it pointing at fonts.
 * `lib/slack/dispatch` reaches `to-site-config` through the AI edit path, and
 * `to-site-config` needs the font REGISTRY (which keys are valid) but never
 * the loaded fonts — hence `lib/theme/font-registry` holding the data and
 * `lib/theme/fonts` holding the `next/font` calls.
 *
 * Loading these under vitest is the same test: no Next compilation either.
 *
 * Each case carries an explicit timeout. These are the only tests in the suite
 * whose work IS a cold module graph — dispatch pulls in LangChain and the
 * whole AI edit path — so on a cold vitest cache they transform hundreds of
 * files and blow the 5s default, failing as a timeout that says nothing about
 * the boundary they exist to protect. The number is a ceiling on transform
 * time, not an assertion about the import.
 */
const COLD_IMPORT_TIMEOUT_MS = 30_000;
describe("task import boundary", () => {
  it(
    "loads the Slack dispatcher outside a Next.js build",
    async () => {
      const mod = await import("@/lib/slack/dispatch");

      expect(typeof mod.handlePrompt).toBe("function");
      expect(typeof mod.buildStatus).toBe("function");
    },
    COLD_IMPORT_TIMEOUT_MS
  );

  it(
    "loads the shared AI edit run outside a Next.js build",
    async () => {
      const mod = await import("@/lib/ai/editor-prompt-run");

      expect(typeof mod.runEditorPromptJob).toBe("function");
    },
    COLD_IMPORT_TIMEOUT_MS
  );

  it("resolves a site config without loading any font", async () => {
    // The specific chain that used to reach `next/font`.
    const mod = await import("@/lib/site/to-site-config");

    expect(typeof mod.toSiteConfig).toBe("function");
  });

  it("keeps the font registry free of next/font", async () => {
    const registry = await import("@/lib/theme/font-registry");

    expect(registry.isValidFontKey("inter")).toBe(true);
    expect(registry.isValidFontKey("comic-sans")).toBe(false);
    expect(registry.fontKeyToCssVar("montserrat")).toBe("var(--font-montserrat)");
    // An unknown key must still produce a defined variable rather than
    // `var(undefined)` on a church's public page.
    expect(registry.fontKeyToCssVar("nope")).toBe("var(--font-inter)");
    // Georgia/Helvetica have no next/font entry — a literal stack, not a
    // reference to an undefined CSS variable.
    expect(registry.fontKeyToCssVar("georgia")).toBe("Georgia, 'Times New Roman', serif");
    expect(registry.isStaticFontKey("georgia")).toBe(true);
    expect(registry.isStaticFontKey("montserrat")).toBe(false);
  });
});
