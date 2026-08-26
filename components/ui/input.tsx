import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Fields share the button's 8px radius and 36px height, so a field and the
 * button beside it line up exactly. See `components/ui/button.tsx` for why the
 * pill went away.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(
          "flex h-9 w-full min-w-0 rounded-lg border border-input bg-surface px-3 text-sm text-foreground shadow-[var(--shadow-soft)] transition-colors outline-none",
          "placeholder:text-muted-foreground/70",
          "focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
