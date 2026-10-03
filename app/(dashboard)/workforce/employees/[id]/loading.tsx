import { Skeleton } from "@/components/kit/skeleton";

/** Record skeleton (E11): page bar, header strip, tabs and two sheets. */
export default function EmployeeRecordLoading() {
  return (
    <div role="status" aria-label="Loading employee">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-3">
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-40" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-line-card bg-surface p-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-2.5 w-80" />
        </div>
      </div>
      <Skeleton className="mb-4 h-9 w-full max-w-xl" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  );
}
