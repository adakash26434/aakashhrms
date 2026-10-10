import { GridSkeleton, Skeleton } from "@/components/kit/skeleton";

/** Register skeleton (E11): page bar, filters and grid. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading roles">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-2.5 w-96 max-w-full" />
        </div>
        <Skeleton className="h-8 w-72 max-w-[50%]" />
      </div>
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-40" />
      </div>
      <GridSkeleton rows={10} columns={6} />
    </div>
  );
}
