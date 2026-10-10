import { Skeleton } from "@/components/kit/skeleton";
import { cn } from "@/lib/utils";

/** Report viewer skeleton (4.11): page bar, the parameters panel and a sheet of paper. */
export function ReportViewerSkeleton({ landscape = false }: { landscape?: boolean }) {
  return (
    <div role="status" aria-label="Loading report">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-2.5 w-96 max-w-full" />
        </div>
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <div className="space-y-3 rounded-md border border-line-card p-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="rounded-md bg-canvas p-3">
          <div className={cn("mx-auto space-y-3 bg-white p-6 ring-1 ring-line", landscape ? "max-w-5xl" : "max-w-3xl")}>
            <Skeleton className="mx-auto h-4 w-56" />
            <Skeleton className="mx-auto h-2.5 w-72" />
            <Skeleton className="h-2.5 w-48" />
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="h-3 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
