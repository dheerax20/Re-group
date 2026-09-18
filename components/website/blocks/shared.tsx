import { Music, Ticket, Users } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The small presentational pieces the block renderer shares.
 *
 * These used to live in `components/website/sections/`, alongside the fixed
 * per-section components (hero.tsx, sermons.tsx, …) that the AI block tree
 * replaced. That folder is gone; these three survived it because they are the
 * only parts that were never about a specific section — they render a data
 * block that has nothing to show, an eyebrow in one of the art direction's
 * accent treatments, and a stat chip.
 */

/**
 * What a collection shows before the church has added anything to it.
 *
 * The line and the glyph, one entry per collection, rather than a `message`
 * prop. Three call sites passing three ad-hoc strings is how "No upcoming
 * events." and "Ministries are being added soon." ended up in two different
 * voices on the same page.
 *
 * None of these invents a fact about a church — each is true of any
 * congregation on day one or day one thousand, which is the same rule
 * `lib/site/templates/copy.ts` documents for its fallbacks.
 */
const EMPTY_KIND = {
  sermon: { Icon: Music, line: "Your next sermon will land here soon." },
  event: { Icon: Ticket, line: "Check back soon — the next gathering is being planned." },
  ministry: { Icon: Users, line: "Groups and teams are being added soon." },
} as const;

export type EmptyStateKind = keyof typeof EMPTY_KIND;

/**
 * A data-bound block whose collection is empty.
 *
 * Every site is generated BEFORE it has a single sermon or event, so this is
 * the first thing a church sees on their own homepage. It has to read as a
 * finished page waiting for content rather than as a failed load — the version
 * this replaced put a 112px brand gradient slab where a card's photograph would
 * go, which read as a broken image, with a dashed border under it, which read
 * as unfinished.
 *
 * Deliberately NOT layout-aware: `grid`, `list`, `featured` and `calendar` all
 * early-return this. An empty collection has no layout to vary.
 *
 * No `tone` prop either. No band rhythm emits `inverted` any more
 * (`tests/design-pass.test.ts` asserts it), so a collection can only land on a
 * 5-10% wash over the page background, all of which take ordinary dark text.
 * A church that asks the editor for a dark band explicitly is the one case left
 * — see WS-B.3.
 */
export function EmptyState({ kind }: { kind: EmptyStateKind }) {
  const { Icon, line } = EMPTY_KIND[kind];

  return (
    /* `w-full` for the same reason `row` and `stack` carry it: the collection
       views early-return this, bypassing their own `grid w-full` wrapper, so
       without it a church with no sermons yet gets a card only as wide as the
       sentence inside it.

       The `ring` is not in the reference comps, which only show this on a white
       page. It is imperceptible there, and it is what keeps the card reading as
       a card on a band whose own background is a wash of the same accent —
       which Community Forward's events band is. */
    <div className="flex w-full items-center gap-6 rounded-3xl bg-site-accent/10 p-8 ring-1 ring-site-accent/20 sm:p-10">
      <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-site-accent/10 sm:size-20">
        <span className="flex size-12 items-center justify-center rounded-full bg-site-accent/20 sm:size-14">
          <Icon className="size-6 text-site-accent" strokeWidth={1.75} aria-hidden />
        </span>
      </span>
      <p className="text-base text-site-muted sm:text-lg">{line}</p>
    </div>
  );
}

/**
 * An eyebrow in one of the four accent treatments the art direction can pick
 * (`none`, `line`, `bordered`, `numbered`) — this is a big part of why two
 * builds on the same direction don't read as the same page.
 */
export function TraitEyebrow({
  children,
  accent,
  tone = "default",
}: {
  children: React.ReactNode;
  accent?: "none" | "line" | "bordered" | "numbered";
  tone?: "default" | "light";
}) {
  const base = "text-sm font-semibold uppercase tracking-wider sm:text-base";
  const color = tone === "light" ? "text-current" : "text-site-accent";

  if (accent === "bordered") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-3 py-1",
          base,
          color,
          tone === "light" ? "border-current/30" : "border-site-accent/30"
        )}
      >
        {children}
      </span>
    );
  }

  if (accent === "numbered") {
    return (
      <span className={cn("inline-flex items-center gap-2", base, color)}>
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px]",
            tone === "light" ? "bg-current/15" : "bg-site-accent/15"
          )}
        >
          •
        </span>
        {children}
      </span>
    );
  }

  return (
    <div className="inline-block">
      <p className={cn(base, color)}>{children}</p>
      {accent === "line" ? (
        <span
          className={cn(
            "mt-2 block h-0.5 w-10 rounded-full",
            tone === "light" ? "bg-current/60" : "bg-site-accent/60"
          )}
        />
      ) : null}
    </div>
  );
}

/**
 * A single label/value chip from a `stats` block.
 *
 * Everything here is `currentColor`, not white. A stats block lands inside
 * whatever band the composer put it in, and that band's background token
 * already resolved a readable foreground (`text-site-primary-foreground` and
 * friends) — inheriting it means the chip is legible on a dark hero AND on a
 * pale brand colour, which a hardcoded white never was.
 */
export function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-current/15 bg-current/10 px-4 py-3 backdrop-blur-sm">
      <p className="text-sm uppercase tracking-wider text-current/70">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-current">{value}</p>
    </div>
  );
}
