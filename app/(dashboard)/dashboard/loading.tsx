import { Skeleton } from "@/components/kit/skeleton";

function PanelSkeleton({ rows = 3, tall }: { rows?: number; tall?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="flex h-10 items-center gap-2 border-b border-line px-3">
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-2.5 w-28" />
      </div>
      <div className={tall ? "grid min-h-72 md:grid-cols-[260px_1fr]" : "space-y-3 p-3"}>
        {tall ? (
          <>
            <div className="space-y-3 border-r border-line p-3">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-2.5 w-32" />
                  <Skeleton className="h-2 w-20" />
                </div>
              ))}
            </div>
            <div className="space-y-3 p-4">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-24 w-full" />
            </div>
          </>
        ) : (
          Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-2.5 w-full" />)
        )}
      </div>
    </div>
  );
}

/** Home skeleton (E11): same page bar, cue strip and two-column layout as the page. */
export default function HomeLoading() {
  return (
    <div role="status" aria-label="Loading Home" className="mx-auto w-full max-w-[1600px]">
      <div className="mb-4 space-y-1.5 border-b border-line pb-3">
        <Skeleton className="h-2 w-16" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-2.5 w-72" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-line bg-surface px-3 pb-2.5 pt-3">
            <Skeleton className="h-2 w-16" />
            <Skeleton className="h-5 w-10" />
            <Skeleton className="h-2 w-24" />
          </div>
        ))}
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <div className="space-y-4">
          <PanelSkeleton tall />
          <PanelSkeleton rows={4} />
        </div>
        <div className="space-y-4">
          <PanelSkeleton rows={4} />
          <PanelSkeleton rows={3} />
          <PanelSkeleton rows={3} />
        </div>
      </div>
    </div>
  );
}
