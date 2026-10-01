/**
 * Loading skeleton for the Tax Rate Setup page.
 *
 * Mirrors the final layout: hero with title + FY pill, tab bar,
 * per-category slabs card with a header row + 4 skeleton rows, and
 * a row of 3 KPI cards at the bottom. Pure presentational — no data.
 */
export default function TaxRatesLoading() {
  return (
    <div className="mx-auto max-w-[1400px] animate-pulse space-y-6 p-6">
      {/* Hero skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded bg-payroll-border/80" />
          <div className="h-4 w-160 max-w-full rounded bg-payroll-border/40" />
        </div>
        <div className="h-9 w-40 rounded-lg bg-payroll-border/80" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-1 rounded-lg border border-payroll-border bg-white p-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-28 rounded-md bg-payroll-border/60" />
        ))}
      </div>

      {/* Slabs card skeleton */}
      <div className="overflow-hidden rounded-xl border border-payroll-border bg-white">
        <div className="flex items-center justify-between border-b border-payroll-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-payroll-border/80" />
            <div className="space-y-1.5">
              <div className="h-4 w-32 rounded bg-payroll-border/80" />
              <div className="h-3 w-40 rounded bg-payroll-border/40" />
            </div>
          </div>
          <div className="h-9 w-28 rounded-lg bg-payroll-border/80" />
        </div>
        <div className="border-b border-payroll-border bg-payroll-cream px-5 py-3">
          <div className="grid grid-cols-6 gap-4">
            <div className="h-3 w-8 rounded bg-payroll-border/80" />
            <div className="h-3 w-24 rounded bg-payroll-border/80" />
            <div className="h-3 w-20 rounded bg-payroll-border/80" />
            <div className="h-3 w-16 rounded bg-payroll-border/80" />
            <div className="h-3 w-28 rounded bg-payroll-border/80" />
            <div className="h-3 w-12 justify-self-end rounded bg-payroll-border/80" />
          </div>
        </div>
        <div className="divide-y divide-payroll-border">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-6 items-center gap-4 px-5 py-5">
              <div className="h-3.5 w-4 self-center rounded bg-payroll-border/60" />
              <div className="h-3.5 w-20 self-center rounded bg-payroll-border/60" />
              <div className="h-3.5 w-20 self-center rounded bg-payroll-border/60" />
              <div className="h-5 w-12 self-center rounded-full bg-payroll-border/60" />
              <div className="h-3.5 w-20 self-center rounded bg-payroll-border/60" />
              <div className="flex justify-end gap-1 self-center">
                <div className="h-7 w-7 rounded bg-payroll-border/60" />
                <div className="h-7 w-7 rounded bg-payroll-border/60" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-payroll-border bg-white p-5"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-payroll-border/80" />
              <div className="space-y-1.5">
                <div className="h-3 w-20 rounded bg-payroll-border/60" />
                <div className="h-5 w-16 rounded bg-payroll-border/80" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
