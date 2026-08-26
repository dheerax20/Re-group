import { cn } from "@/lib/utils";

/**
 * A titled group of content inside a page.
 *
 * Pages are built from Sections, not from a grid of cards. The old dashboard
 * wrapped every idea in its own bordered panel, so five unrelated things all
 * shouted at the same volume and the page grew to fill a screen and a half.
 * A Section is a heading, one optional sentence, and its content — the border
 * only appears where the content itself needs a surface.
 */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * The vertical rhythm of a page body. One value, applied once, so no screen
 * has to invent its own spacing between sections.
 */
export function PageSections({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-8", className)}>{children}</div>;
}
