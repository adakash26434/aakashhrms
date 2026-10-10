import { GridSkeleton, Skeleton } from "@/components/kit/skeleton";

/** Detail changes skeleton: page bar, filter strip and grid. */
export default function DetailChangesLoading() {
  return (
    <div role="status" aria-label="Loading detail changes">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-2.5 w-72" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-40" />
      </div>
      <GridSkeleton rows={8} columns={5} />
    </div>
  );
}
