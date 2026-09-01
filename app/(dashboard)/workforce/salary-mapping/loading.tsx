export default function SalaryMappingLoading() {
  return (
    <div className="mx-auto max-w-350 space-y-6 p-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded-md bg-gray-200" />
          <div className="h-4 w-96 animate-pulse rounded-md bg-gray-100" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-[#d7e8d0]/80 bg-white p-5"
          >
            <div className="h-3 w-20 rounded bg-gray-200" />
            <div className="mt-2 h-6 w-16 rounded bg-gray-200" />
          </div>
        ))}
      </div>

      {/* Filters skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-9 w-48 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-9 w-48 animate-pulse rounded-lg bg-gray-200" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-[#d7e8d0]/80 bg-white p-5">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}