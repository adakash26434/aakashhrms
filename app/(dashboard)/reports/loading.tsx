import { Skeleton } from "@/components/kit/skeleton";

/** Reports skeleton: page bar and the report groups. */
export default function ReportsLoading() {
  return (
    <div role="status" aria-label="Loading reports">
      <div className="mb-4 space-y-1.5 border-b border-line pb-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-2.5 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 3 }, (_, g) => (
          <div key={g} className="space-y-3 rounded-md border border-line-card p-4">
            <Skeleton className="h-3 w-28" />
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-2.5 w-full" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
