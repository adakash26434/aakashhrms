import { GridSkeleton, Skeleton } from "@/components/kit/skeleton";

/** Opening balances skeleton: page bar, notice and grid. */
export default function OpeningBalancesLoading() {
  return (
    <div role="status" aria-label="Loading opening balances">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-2.5 w-80" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>
      <Skeleton className="mb-3 h-12 w-full" />
      <GridSkeleton rows={8} columns={7} />
    </div>
  );
}
