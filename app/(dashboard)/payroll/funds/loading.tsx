import { GridSkeleton, Skeleton } from "@/components/kit/skeleton";

/** Register skeleton (E11): page bar, tabs and grid. */
export default function FundsLoading() {
  return (
    <div role="status" aria-label="Loading welfare funds">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-2.5 w-80" />
        </div>
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-24" />
      </div>
      <GridSkeleton rows={10} columns={6} />
    </div>
  );
}
