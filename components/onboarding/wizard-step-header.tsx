import { ArcFlourish } from "./wizard-art";

/**
 * The heading at the top of every wizard step.
 *
 * The flourish is anchored to the panel's top-right corner and drawn behind
 * the text at low opacity. It is `aria-hidden` inside `ArcFlourish`, and the
 * heading itself is untouched — a screen reader still gets an `h1` and a
 * paragraph, in that order, with nothing else in between.
 */
export function WizardStepHeader({
  title,
  description,
  eyebrow,
}: {
  title: string;
  description: string;
  /** Optional kicker above the title — used where a step needs framing. */
  eyebrow?: string;
}) {
  return (
    <div className="relative mb-2 border-b border-border pb-6">
      <ArcFlourish className="-right-10 -top-16 size-40 opacity-50" />

      <div className="relative">
        {eyebrow ? (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-serif text-[1.85rem] font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
      </div>
    </div>
  );
}
