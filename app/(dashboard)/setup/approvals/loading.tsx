import { Skeleton } from "@/components/kit/skeleton";

/** Settings skeleton (E11): page bar and the module panels. */
export default function ApprovalsLoading() {
  return (
    <div role="status" aria-label="Loading approval settings">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-2.5 w-96 max-w-full" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid gap-4">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  );
}
