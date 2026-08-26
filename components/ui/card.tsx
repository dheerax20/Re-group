import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The product's surface primitive.
 *
 * Everything here is token-driven, and the
 * `rounded-panel border border-border bg-surface shadow-[var(--shadow-soft)]`
 * incantation that was pasted across a dozen pages lives in one place.
 *
 * `feature` is deliberately quiet. It used to be a tinted brand panel, which
 * meant any screen with two or three "important" things on it turned into a
 * wall of colour; emphasis now comes from a slightly stronger border and the
 * one filled button inside, not from painting the container.
 */
const cardVariants = cva("rounded-panel border transition-colors", {
  variants: {
    variant: {
      /** Default: sits on the page background. */
      raised: "border-border bg-surface shadow-[var(--shadow-soft)]",
      /** Quieter: for panels nested inside another card. */
      flat: "border-border bg-surface-muted/60",
      /** For empty states and drop targets. */
      dashed: "border-dashed border-border-strong bg-surface-muted/40",
      /** Draws the eye to one primary action or announcement. */
      feature: "border-border-strong bg-surface shadow-[var(--shadow-soft)]",
    },
    padding: {
      none: "",
      sm: "p-3.5",
      md: "p-4 sm:p-5",
      lg: "p-5 sm:p-6",
    },
    interactive: {
      true: "hover:border-border-strong hover:shadow-[var(--shadow-lift)]",
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
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-sm font-semibold text-foreground text-balance", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[13px] leading-relaxed text-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-4 flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}

export { cardVariants };
