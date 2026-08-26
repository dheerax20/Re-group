import * as React from "react";
import { cn } from "@/lib/utils";

/** Native select compatible with react-hook-form `register()`. */
export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground shadow-[var(--shadow-soft)] transition-colors outline-none",
      "focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/20",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
NativeSelect.displayName = "NativeSelect";
