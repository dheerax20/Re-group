import { createHash } from "node:crypto";
import type { PageBlocks } from "./types";

/**
 * A stable fingerprint of a block tree, so undo can tell whether the page it
 * is about to revert is still the one this job wrote.
 *
 * Keys are sorted before hashing, and that is not tidiness — it is required.
 * The hash is computed over an in-memory tree and later compared against one
 * that has been round-tripped through a Postgres `jsonb` column, and `jsonb`
 * does not preserve key order: it stores a parsed form and re-emits keys in
 * its own order. A plain `JSON.stringify` would therefore disagree with
 * itself across the round trip and report "the site changed since" on every
 * single undo, training churches to ignore the one warning that matters.
 */
export function hashBlocks(blocks: PageBlocks): string {
  return createHash("sha256").update(canonicalJson(blocks)).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      // `undefined` has no JSON representation and simply vanishes from
      // `JSON.stringify` output, so it must vanish here too or the two
      // encodings disagree about a key that was never really there.
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value) ?? "null";
}
