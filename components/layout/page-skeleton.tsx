import { Skeleton } from "@/components/ui/skeleton";

export function ChurchPageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="mx-auto max-w-5xl animate-in fade-in duration-200">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <div
            key={index}
            className="rounded-panel border border-border bg-surface p-5 shadow-[var(--shadow-soft)]"
          >
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
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
