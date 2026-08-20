/**
 * Re-runs the deterministic design pass over every site's stored block tree.
 *
 * Run from the repo root, after deploying the design-pass change:
 *
 *   npm run blocks:restyle
 *
 * Why it is needed: `applyDesignPass` runs at build time
 * (`lib/ai/agents/assemble.ts`), so sites composed before it existed keep the
 * rhythm the model happened to emit — which for most of them means bands with
 * no `padding` at all, no background alternation, and a page full of empty
 * photo slots. Without this they only improve when somebody clicks Rebuild,
 * which also rewrites all their copy.
 *
 * Idempotent: the pass is a pure function of the tree, so a second run
 * produces byte-identical output and writes nothing.
 *
 * WARNING: this re-flows the WHOLE page — padding, background alternation,
 * alignment, and the empty-photo cap. That is what you want on a site the crew
 * built and nobody has touched; it will overwrite deliberate choices on a site
 * a church has since edited through the assistant. Run `--dry-run` first and
 * read the list.
 *
 * Note the renderer's `padding ?? "lg"` default already rescues the worst of
 * the spacing on every site without any migration — this is what fixes the
 * rhythm, alternation and photo-slot count on top of that.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { coerceBlocks } from "../lib/site/blocks/schema";
import { applyDesignPass } from "../lib/site/blocks/design-pass";
import { invalidateSite } from "../lib/site/invalidate";

try {
  process.loadEnvFile();
} catch {
  // no .env next to cwd — assume env vars are already set (e.g. CI)
}

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  // `{ not: undefined }` is a no-op — Prisma strips undefined, so it selected
  // every site including those with no block tree at all.
  const sites = await prisma.site.findMany({
    where: { NOT: { blockConfig: { equals: Prisma.DbNull } } },
    select: { id: true, slug: true, name: true, blockConfig: true },
  });

  let changed = 0;
  let skipped = 0;

  for (const site of sites) {
    const before = coerceBlocks(site.blockConfig);
    if (before.length === 0) {
      skipped += 1;
      continue;
    }

    const after = applyDesignPass(before);
    if (JSON.stringify(after) === JSON.stringify(before)) {
      skipped += 1;
      continue;
    }

    changed += 1;
    console.log(`${DRY_RUN ? "would restyle" : "restyling"}  ${site.slug}  (${site.name})`);

    if (DRY_RUN) continue;

    await prisma.site.update({
      where: { id: site.id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { blockConfig: after as any },
    });
    await invalidateSite(site.id, { slug: site.slug });
  }

  console.log(
    `\n${DRY_RUN ? "[dry run] " : ""}${changed} site(s) restyled, ${skipped} already current.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
