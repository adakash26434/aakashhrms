import { FormSkeleton, Skeleton } from "@/components/kit/skeleton";

/** Form skeleton (E11): page bar, section index and the first sections. */
export default function EmployeeFormLoading() {
  return (
    <div role="status" aria-label="Loading form">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-3">
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-40" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <div className="hidden space-y-2 lg:block">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
        <div className="space-y-5">
          <FormSkeleton fields={3} />
          <FormSkeleton fields={4} />
        </div>
      </div>
    </div>
  );
}
