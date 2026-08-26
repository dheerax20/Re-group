import { cn } from "@/lib/utils";

/**
 * The one page header.
 *
 * The type scale is fixed here and nowhere else: 24px semibold title, 13px
 * muted description, and — critically — the same bottom margin on every
 * screen. Pages used to each pick their own, which is why moving between them
 * felt like moving between products.
 *
 * `eyebrow` carries the section a screen belongs to (Website Builder →
 * Domains) when the title alone is ambiguous.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-foreground text-balance">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
