import { GridSkeleton, Skeleton } from "@/components/kit/skeleton";

/** Register skeleton (E11): page bar, filter strip and grid in the page's own layout. */
export default function EmployeesLoading() {
  return (
    <div role="status" aria-label="Loading employees">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-2.5 w-64" />
        </div>
        <Skeleton className="h-8 w-72" />
      </div>
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-32" />
      </div>
      <GridSkeleton rows={12} columns={8} />
    </div>
  );
}
