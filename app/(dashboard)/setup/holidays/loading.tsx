/**
 * Loading skeleton for the Holiday Setup page.
 *
 * Mirrors the final layout: hero with title + New button, 3
 * KPI cards (Total / Days / All-Branch), search input, holiday
 * card grid, and the "How holidays work" info card. Pure
 * presentational — no data.
 */
export default function HolidaysLoading() {
  return (
    <div className="mx-auto max-w-350 animate-pulse space-y-6 p-6">
      {/* Hero skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded bg-[#d7e8d0]/60" />
          <div className="h-4 w-180 max-w-full rounded bg-[#d7e8d0]/40" />
        </div>
        <div className="h-9 w-40 rounded-lg bg-[#d7e8d0]/60" />
      </div>

      {/* KPI cards skeleton (3 cards) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[#d7e8d0]/80 bg-white p-5"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#d7e8d0]/60" />
              <div className="space-y-1.5">
                <div className="h-3 w-20 rounded bg-[#d7e8d0]/50" />
                <div className="h-5 w-12 rounded bg-[#d7e8d0]/60" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search row skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-9 w-full max-w-md rounded-lg bg-[#d7e8d0]/50" />
        <div className="h-3 w-32 rounded bg-[#d7e8d0]/40" />
      </div>

      {/* Holiday card grid skeleton (6 cards in 3 columns) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[#d7e8d0]/80 bg-white p-5"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-[#d7e8d0]/60" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3.5 w-24 rounded bg-[#d7e8d0]/60" />
                <div className="h-3 w-20 rounded bg-[#d7e8d0]/40" />
              </div>
              <div className="flex shrink-0 gap-1">
                <div className="h-7 w-7 rounded bg-[#d7e8d0]/40" />
                <div className="h-7 w-7 rounded bg-[#d7e8d0]/40" />
              </div>
            </div>
            <div className="my-3 border-t border-[#d7e8d0]/60" />
            <div className="space-y-2.5">
              <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3">
                <div className="h-3 w-16 rounded bg-[#d7e8d0]/40" />
                <div className="h-3.5 w-36 rounded bg-[#d7e8d0]/50" />
              </div>
              <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3">
                <div className="h-3 w-10 rounded bg-[#d7e8d0]/40" />
                <div className="h-5 w-14 rounded bg-[#d7e8d0]/50" />
              </div>
              <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3">
                <div className="h-3 w-14 rounded bg-[#d7e8d0]/40" />
                <div className="h-3.5 w-32 rounded bg-[#d7e8d0]/50" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info card skeleton */}
      <div className="rounded-xl border border-[#d7e8d0]/80 bg-white p-5">
        <div className="flex gap-3">
          <div className="h-5 w-5 shrink-0 rounded-full bg-[#d7e8d0]/60" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-[#d7e8d0]/60" />
            <div className="h-3 w-full max-w-3xl rounded bg-[#d7e8d0]/40" />
            <div className="h-3 w-5/6 max-w-3xl rounded bg-[#d7e8d0]/40" />
            <div className="h-3 w-4/6 max-w-3xl rounded bg-[#d7e8d0]/40" />
          </div>
        </div>
      </div>
    </div>
  );
}
