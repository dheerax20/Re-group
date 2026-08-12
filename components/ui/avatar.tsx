import { cn } from "@/lib/utils";

export function Avatar({
  initials,
  className,
}: {
  initials: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand",
        className
      )}
    >
      {initials}
    </div>
  );
}
