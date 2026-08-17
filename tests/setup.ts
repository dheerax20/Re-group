import { vi } from "vitest";

/**
 * `next/font/google` only works inside Next's own build pipeline — outside
 * it (here, under plain Vitest/Node) calling one of its exports throws
 * immediately. `lib/theme/fonts.ts` calls several of them at module scope,
 * and anything importing it transitively (`to-site-config.ts` among them)
 * would otherwise fail to even load in a test file.
 *
 * Named ESM imports are checked against the mock's own exports, so a
 * catch-all Proxy isn't enough — each font actually imported in
 * `lib/theme/fonts.ts` needs a named stub here. Add to this list if that file
 * ever imports another one.
 */
vi.mock("next/font/google", () => {
  const stubFont = () => ({ className: "", variable: "" });
  return {
    Inter: stubFont,
    DM_Sans: stubFont,
    Playfair_Display: stubFont,
    Cormorant_Garamond: stubFont,
    Montserrat: stubFont,
  };
});
