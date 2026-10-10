import { GridSkeleton, Skeleton } from "@/components/kit/skeleton";

/** Leave salary skeleton: page bar, guide, tabs, filter strip and grid. */
export default function LeaveSalaryLoading() {
  return (
    <div role="status" aria-label="Loading leave salary">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-2.5 w-80" />
        </div>
        <Skeleton className="h-8 w-56" />
      </div>
      <Skeleton className="mb-3 h-16 w-full" />
      <Skeleton className="mb-3 h-8 w-64" />
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-40" />
      </div>
      <GridSkeleton rows={8} columns={8} />
    </div>
  );
}
