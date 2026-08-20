import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The product's surface primitive.
 *
 * This used to hardcode Tailwind's raw `neutral-200` border and a plain white
 * fill, so every card in the app ignored the design tokens — white-on-warm in
 * light mode, white-on-black in dark. Everything here is token-driven, and the
 * `rounded-panel border border-border bg-surface shadow-[var(--shadow-soft)]`
 * incantation that was pasted across a dozen pages now lives in one place.
 */
const cardVariants = cva("rounded-panel border transition-colors", {
  variants: {
    variant: {
      /** Default: sits on the page background. */
      raised: "border-border bg-surface shadow-[var(--shadow-soft)]",
      /** Quieter: for panels nested inside another card. */
      flat: "border-border bg-background",
      /** For empty states and drop targets. */
      dashed: "border-dashed border-border-strong bg-background",
      /** Draws the eye to one primary action or announcement. */
      feature:
        "border-brand/25 bg-brand-soft/40 shadow-[var(--shadow-soft)]",
    },
    padding: {
      none: "",
      sm: "p-4",
      md: "p-5",
      lg: "p-6 sm:p-8",
    },
    interactive: {
      true: "hover:border-brand/40 hover:shadow-[var(--shadow-lift)]",
      false: "",
    },
  },
  defaultVariants: { variant: "raised", padding: "md", interactive: false },
});

export function Card({
  className,
  variant,
  padding,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant, padding, interactive }), className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-semibold tracking-tight text-foreground text-balance",
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-5 flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}

export { cardVariants };
