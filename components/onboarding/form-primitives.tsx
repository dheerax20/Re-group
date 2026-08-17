import { cn } from "@/lib/utils";

export function FieldGroup({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "space-y-4 rounded-xl border border-border bg-surface-muted/50 p-5",
        className
      )}
    >
      {title || description ? (
        <div className="space-y-1">
          {title ? (
            <h3 className="font-serif text-base font-medium tracking-tight text-foreground">{title}</h3>
          ) : null}
          {description ? <p className="text-sm text-muted">{description}</p> : null}
        </div>
      ) : null}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Field({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-2", className)}>{children}</div>;
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] leading-snug text-muted">{children}</p>;
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-[13px] text-destructive">{children}</p>;
}

export function FormActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-t border-border pt-6",
        className
      )}
    >
      {children}
    </div>
  );
}
