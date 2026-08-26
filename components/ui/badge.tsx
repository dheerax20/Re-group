import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Status and category labels.
 *
 * Token-driven, so "live" reads as success and "action needed" reads as
 * warning without any component knowing a hex. Badges keep `rounded-full` —
 * with controls now at `rounded-lg`, the pill shape is what distinguishes a
 * label you cannot click from a button you can.
 *
 * `dot` adds a coloured marker so state is not carried by colour alone.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand text-brand-foreground",
        secondary: "border-transparent bg-surface-muted text-muted",
        outline: "border-border bg-surface text-muted",
        success: "border-transparent bg-success-soft text-success",
        warning: "border-transparent bg-warning-soft text-warning",
        info: "border-transparent bg-info-soft text-info",
        destructive: "border-transparent bg-destructive-soft text-destructive",
        accent: "border-transparent bg-accent-soft text-accent-strong",
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
