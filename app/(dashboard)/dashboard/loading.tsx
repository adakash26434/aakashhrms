import { Skeleton } from "@/components/kit/skeleton";

function PanelSkeleton({ body }: { body: string }) {
  return (
    <div className="rounded-lg border border-line-card bg-surface shadow-sm">
      <div className="flex h-11 items-center gap-2 rounded-t-lg border-b border-line-strong bg-canvas/70 px-4">
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-2.5 w-32" />
      </div>
      <div className="p-3">
        <Skeleton className={`${body} w-full`} />
      </div>
    </div>
  );
}

/** Dashboard skeleton (E11): page bar, filters, KPI row, chart rows and cards in the page's own layout. */
export default function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading dashboard" className="mx-auto w-full max-w-[1600px]">
      <div className="mb-4 space-y-1.5 border-b border-line pb-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-2.5 w-72" />
      </div>
      <Skeleton className="mb-4 h-8 w-80" />
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-line-card bg-surface shadow-sm px-3.5 py-3">
            <Skeleton className="h-2 w-20" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
      <div className="mb-5 grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <PanelSkeleton body="h-72" />
        </div>
        <PanelSkeleton body="h-72" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <PanelSkeleton body="h-48" />
        <PanelSkeleton body="h-48" />
      </div>
    </div>
  );
}
