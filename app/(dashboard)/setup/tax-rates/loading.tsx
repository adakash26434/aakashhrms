import { Skeleton } from "@/components/kit/skeleton";

/** Settings skeleton (E11): page bar, year, three ladders and the calculator. */
export default function TaxRatesLoading() {
  return (
    <div role="status" aria-label="Loading tax slabs">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-2.5 w-96 max-w-full" />
        </div>
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="mb-3 h-8 w-64" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-56 w-full" />
        ))}
      </div>
      <Skeleton className="mt-3 h-48 w-full" />
    </div>
  );
}
