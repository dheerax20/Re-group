import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Status and category labels.
 *
 * Token-driven rather than the previous raw `neutral-*` / `emerald-*` classes,
 * which did not follow the palette and became illegible in dark mode. Status
 * variants map to the semantic tokens, so "live" reads as success and "action
 * needed" reads as warning in both themes.
 *
 * `dot` adds a coloured marker so state is not carried by colour alone.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-brand text-brand-foreground",
        secondary: "bg-surface-muted text-foreground",
        outline: "border border-border text-muted",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        info: "bg-info-soft text-info",
        destructive: "bg-destructive-soft text-destructive",
        accent: "bg-accent-soft text-accent-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

const DOT_COLOR: Record<string, string> = {
  default: "bg-brand-foreground",
  secondary: "bg-muted",
  outline: "bg-muted",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  destructive: "bg-destructive",
  accent: "bg-accent",
};

export function Badge({
  className,
  variant = "default",
  dot = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? (
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", DOT_COLOR[variant ?? "default"])}
        />
      ) : null}
      {children}
    </span>
  );
}

export { badgeVariants };
