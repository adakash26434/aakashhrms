import { GridSkeleton, Skeleton } from "@/components/kit/skeleton";

/** Register skeleton (E11): page bar, tabs, filter strip and grid. */
export default function EvaluationLoading() {
  return (
    <div role="status" aria-label="Loading evaluations">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-2.5 w-72" />
        </div>
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-32" />
      </div>
      <GridSkeleton rows={10} columns={7} />
    </div>
  );
}
