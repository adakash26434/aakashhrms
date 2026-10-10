import { GridSkeleton, Skeleton } from "@/components/kit/skeleton";

/** Statutory returns skeleton (E11): page bar, month picker, tabs and grid. */
export default function StatutoryLoading() {
  return (
    <div role="status" aria-label="Loading statutory returns">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-2.5 w-96" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-16" />
      </div>
      <GridSkeleton rows={10} columns={8} />
    </div>
  );
}
