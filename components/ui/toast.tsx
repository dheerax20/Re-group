"use client";

import * as React from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { Toast as ToastPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * The product's one transient confirmation.
 *
 * Every save used to report itself differently: a green sentence that appeared
 * under a form and never left, a "Saved" word that faded after 1.6s, or
 * nothing at all. This is the single answer — `toast()` from anywhere inside
 * the app shell, announced politely to screen readers by Radix, dismissible,
 * and gone on its own.
 *
 * Errors are NOT only a toast. Anything a church has to act on (a rejected
 * domain, a failed upload) also stays on the screen next to the control that
 * caused it; the toast is the notification, not the record.
 */

type ToastVariant = "success" | "error" | "info";

type ToastOptions = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Milliseconds on screen. Errors default to longer than confirmations. */
  duration?: number;
};

type ToastEntry = ToastOptions & { id: number };

type ToastContextValue = {
  toast: (options: ToastOptions) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

/**
 * Safe to call outside the provider — it becomes a no-op rather than throwing.
 * Components under this shell always have it; the same components are also
 * rendered by the onboarding wizard and by tests, and a missing toaster is not
 * a reason to crash a church's screen.
 */
export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  return context ?? NOOP_TOAST;
}

const NOOP_TOAST: ToastContextValue = { toast: () => {} };

const VARIANT_ICON: Record<ToastVariant, React.ElementType> = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info,
};

const VARIANT_TONE: Record<ToastVariant, string> = {
  success: "text-success",
  error: "text-destructive",
  info: "text-muted",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastEntry[]>([]);
  const nextId = React.useRef(0);

  const toast = React.useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { ...options, id }]);
  }, []);

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}

        {toasts.map((entry) => {
          const variant = entry.variant ?? "success";
          const Icon = VARIANT_ICON[variant];
          return (
            <ToastPrimitive.Root
              key={entry.id}
              duration={entry.duration ?? (variant === "error" ? 7000 : 4000)}
              onOpenChange={(open) => {
                if (!open) dismiss(entry.id);
              }}
              className={cn(
                "toast-item flex items-start gap-3 rounded-panel border border-border bg-surface p-3.5 shadow-[var(--shadow-lift)]"
              )}
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", VARIANT_TONE[variant])} />
              <div className="min-w-0 flex-1">
                <ToastPrimitive.Title className="text-[13px] font-medium text-foreground">
                  {entry.title}
                </ToastPrimitive.Title>
                {entry.description ? (
                  <ToastPrimitive.Description className="mt-0.5 text-[13px] leading-snug text-muted">
                    {entry.description}
                  </ToastPrimitive.Description>
                ) : null}
              </div>
              <ToastPrimitive.Close
                aria-label="Dismiss"
                className="-mr-1 -mt-1 rounded-md p-1 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}

        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-100 flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-sm" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
