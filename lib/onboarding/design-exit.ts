/**
 * Which way the Brand step leaves, and whether it is allowed to.
 *
 * The Brand step ends in a fork: continue with the pre-built template the
 * church picked, which skips the AI step entirely, or continue to the AI step
 * and generate one. Both are submits of the brand form, which is the point —
 * the AI exit used to be a plain link out of the design picker, so it navigated
 * away without ever submitting and the crew designed against whatever brand had
 * last been persisted rather than the colours the church had just chosen.
 *
 * Pure, and separate from the form, because this is the only actual decision in
 * that fork: everything else is a toast, a scroll and a `router.push`. The
 * suite runs in `node` with no DOM, so a decision worth checking has to be
 * reachable without one.
 */
export type DesignIntent = "template" | "ai";

export type DesignExit =
  | { ok: true; href: string }
  /** The church chose the template exit without having applied a template. */
  | { ok: false; reason: "no-template" };

export function resolveDesignExit(input: {
  intent: DesignIntent;
  /** Whether a pre-built template is currently applied to the site. */
  hasTemplate: boolean;
  templateHref: string;
  aiHref: string;
}): DesignExit {
  if (input.intent === "ai") return { ok: true, href: input.aiHref };

  /**
   * Refused rather than silently redirected to the AI step. A church that
   * clicked "Continue with template" has said what they want; sending them to
   * a build they did not ask for would spend one of their monthly credits on a
   * misread click.
   */
  if (!input.hasTemplate) return { ok: false, reason: "no-template" };

  return { ok: true, href: input.templateHref };
}

/** What the church is told when the template exit is refused. */
export const NO_TEMPLATE_MESSAGE = "Please select a component";
