/**
 * Loading skeleton for the Department Setup page.
 *
 * Mirrors the final layout: hero with title + New button, 4
 * KPI cards (Total / Active / Designations / Employees), the
 * three-tab segment, search + branch filter row, departments
 * table card, and the "How departments work" info card. Pure
 * presentational — no data.
 */
export default function DepartmentsLoading() {
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

      {/* KPI cards skeleton (4 cards) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
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

      {/* Tabs skeleton (3 tabs) */}
      <div className="inline-flex w-full max-w-2xl rounded-xl border border-[#d7e8d0]/80 bg-white p-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 px-4 py-2">
            <div className="mx-auto h-4 w-24 rounded bg-[#d7e8d0]/50" />
          </div>
        ))}
      </div>

      {/* Search row skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-9 w-full max-w-md rounded-lg bg-[#d7e8d0]/50" />
        <div className="flex items-center gap-3">
          <div className="h-9 w-45 rounded-lg bg-[#d7e8d0]/50" />
          <div className="h-3 w-32 rounded bg-[#d7e8d0]/40" />
        </div>
      </div>

      {/* Table card skeleton (7 rows) */}
      <div className="rounded-xl border border-[#d7e8d0]/80 bg-white overflow-hidden">
        {/* Header */}
        <div className="flex border-b border-[#d7e8d0]/80 bg-[#f6faf6]/60 px-5 py-3">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex-1">
              <div className="h-3 w-20 rounded bg-[#d7e8d0]/50" />
            </div>
          ))}
        </div>
        {/* Rows */}
        {[0, 1, 2, 3, 4, 5, 6].map((row) => (
          <div
            key={row}
            className="flex items-center border-b border-[#d7e8d0]/60 px-5 py-4"
          >
            <div className="flex flex-1 items-center gap-2.5">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-[#d7e8d0]/60" />
              <div className="space-y-1">
                <div className="h-3.5 w-28 rounded bg-[#d7e8d0]/60" />
                <div className="h-3 w-16 rounded bg-[#d7e8d0]/40" />
              </div>
            </div>
            <div className="flex-1">
              <div className="h-5 w-20 rounded bg-[#d7e8d0]/50" />
            </div>
            <div className="flex-1">
              <div className="h-3.5 w-24 rounded bg-[#d7e8d0]/50" />
            </div>
            <div className="flex-1">
              <div className="h-3.5 w-16 rounded bg-[#d7e8d0]/50" />
            </div>
            <div className="flex-1">
              <div className="h-3.5 w-12 rounded bg-[#d7e8d0]/50" />
            </div>
            <div className="flex-1">
              <div className="h-5 w-16 rounded bg-[#d7e8d0]/50" />
            </div>
            <div className="flex flex-1 justify-end gap-1">
              <div className="h-7 w-7 rounded bg-[#d7e8d0]/40" />
              <div className="h-7 w-7 rounded bg-[#d7e8d0]/40" />
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