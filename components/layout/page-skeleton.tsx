import { Skeleton } from "@/components/ui/skeleton";

/**
 * The loading shape of a normal dashboard screen.
 *
 * It deliberately mirrors the real layout — header block, then a list — rather
 * than showing a grid of squares. A skeleton that does not match what arrives
 * makes the page appear to jump when it loads, which reads as slower than the
 * same wait with no skeleton at all.
 *
 * No container of its own: `AppChrome` already provides the one content column
 * every screen shares.
 */
export function ChurchPageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-in fade-in duration-200">
      <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-3.5 w-72" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-panel border border-border bg-surface">
        {Array.from({ length: rows }).map((_, index) => (
          <div className="flex items-center gap-3 px-3.5 py-3" key={index}>
            <Skeleton className="size-8 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BuilderCanvasSkeleton() {
  return (
    <div className="flex h-full min-h-[70vh] flex-col bg-editor-canvas">
      <div className="flex h-12 items-center justify-between border-b border-border bg-surface px-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
        <div className="hidden space-y-2 border-r border-border p-3 lg:block">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="regroup-grid p-6">
          <div className="mx-auto max-w-[1100px] overflow-hidden rounded-panel bg-surface p-6 shadow-[var(--shadow-lift)]">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="mt-4 h-48 w-full" />
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </div>
          </div>
        </div>
        <div className="hidden space-y-3 border-l border-border p-4 lg:block">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
