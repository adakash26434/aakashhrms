import { cn } from "@/lib/utils";

/** Skeletons shaped like the layout they replace (E11), so nothing jumps on load. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-pulse rounded bg-surface-sunken", className)} />;
}

export function GridSkeleton({ rows = 8, columns = 6, rowHeight = 32 }: { rows?: number; columns?: number; rowHeight?: number }) {
  return (
    <div role="status" aria-label="Loading" className="overflow-hidden rounded-lg border border-line">
      <div className="flex h-8 items-center gap-4 border-b border-line-strong bg-surface-sunken px-3">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className={cn("h-2.5", i === 1 ? "w-40" : "w-20")} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-line px-3 last:border-b-0" style={{ height: rowHeight }}>
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={cn("h-2.5", c === 1 ? "w-40" : c === columns - 1 ? "ml-auto w-16" : "w-20")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="grid gap-1.5 md:grid-cols-[180px_1fr] md:items-center md:gap-4">
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="h-8 w-full max-w-md" />
        </div>
      ))}
    </div>
  );
}
