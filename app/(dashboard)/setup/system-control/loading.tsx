import { FormSkeleton, Skeleton } from "@/components/kit/skeleton";

/** Settings skeleton (E11): page bar, section index and the form. */
export default function SystemControlLoading() {
  return (
    <div role="status" aria-label="Loading rules and controls">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-2.5 w-96 max-w-full" />
        </div>
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <div className="hidden space-y-2 lg:block">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
        <FormSkeleton fields={10} />
      </div>
    </div>
  );
}
