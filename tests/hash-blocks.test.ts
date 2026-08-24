import { describe, expect, it } from "vitest";
import { hashBlocks } from "@/lib/site/blocks/fingerprint";
import type { PageBlocks } from "@/lib/site/blocks/types";

/**
 * The undo fingerprint has to survive a round trip through Postgres.
 *
 * `writtenBlocksHash` is computed over the in-memory tree at write time, and
 * compared at undo time against the tree read back out of a `jsonb` column.
 * `jsonb` does not preserve key order — it stores a parsed form and re-emits
 * keys in its own order — so a hash over raw `JSON.stringify` output would
 * disagree with itself across that round trip and warn "the site changed
 * since this edit" on every undo. A warning that always fires is a warning
 * nobody reads, which is worse than none.
 */
describe("hashBlocks", () => {
  it("ignores key order", () => {
    const written = [
      { id: "hero", type: "band", children: [{ id: "h1", type: "heading", text: "Welcome" }] },
    ] as unknown as PageBlocks;

    // The same tree as Postgres would hand it back: same data, keys reordered.
    const readBack = [
      { children: [{ text: "Welcome", type: "heading", id: "h1" }], type: "band", id: "hero" },
    ] as unknown as PageBlocks;

    expect(hashBlocks(readBack)).toBe(hashBlocks(written));
  });

  it("still notices a real change", () => {
    const before = [{ id: "hero", type: "heading", text: "Welcome" }] as unknown as PageBlocks;
    const after = [{ id: "hero", type: "heading", text: "Welcome!" }] as unknown as PageBlocks;

    expect(hashBlocks(after)).not.toBe(hashBlocks(before));
  });

  it("does not ignore ARRAY order, which is block order", () => {
    // Reordering bands is a real edit; only object keys are unordered.
    const a = [{ id: "one" }, { id: "two" }] as unknown as PageBlocks;
    const b = [{ id: "two" }, { id: "one" }] as unknown as PageBlocks;

    expect(hashBlocks(a)).not.toBe(hashBlocks(b));
  });

  it("treats an absent key and an undefined one as the same tree", () => {
    // `JSON.stringify` drops undefined values, so the column never holds them
    // and the two encodings must agree that they were never there.
    const withUndefined = [{ id: "hero", alt: undefined }] as unknown as PageBlocks;
    const without = [{ id: "hero" }] as unknown as PageBlocks;

    expect(hashBlocks(withUndefined)).toBe(hashBlocks(without));
  });

  it("distinguishes null from absent", () => {
    const nulled = [{ id: "hero", alt: null }] as unknown as PageBlocks;
    const absent = [{ id: "hero" }] as unknown as PageBlocks;

    expect(hashBlocks(nulled)).not.toBe(hashBlocks(absent));
  });
});
