import { Skeleton } from "@/components/kit/skeleton";

export default function PayrollControlsLoading() {
  return (
    <div role="status" aria-label="Loading payroll controls">
      <div className="mb-4 space-y-1.5 border-b border-line pb-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-2.5 w-80" />
      </div>
      <Skeleton className="h-40 w-full max-w-2xl" />
    </div>
  );
}
