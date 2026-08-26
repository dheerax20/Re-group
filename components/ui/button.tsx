import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * The product's one button.
 *
 * Controls are `rounded-lg`, not pills. The pill read as consumer-app and,
 * next to a `rounded-panel` card, gave the interface two unrelated corner
 * radii on the same row — the single most visible symptom of the old
 * inconsistency. One radius scale now runs the whole chrome: 8px controls
 * inside 12px containers, with `rounded-full` reserved for badges and avatars.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[var(--shadow-soft)] hover:bg-brand-strong",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-surface text-foreground shadow-[var(--shadow-soft)] hover:bg-surface-muted hover:text-foreground",
        secondary:
          "bg-surface-muted text-secondary-foreground hover:bg-border/70",
        ghost: "text-muted hover:bg-surface-muted hover:text-foreground",
        link: "text-brand underline-offset-4 hover:underline",
        site: "bg-site-primary text-site-primary-foreground hover:opacity-90",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 px-3 text-[13px]",
        lg: "h-10 px-5",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
