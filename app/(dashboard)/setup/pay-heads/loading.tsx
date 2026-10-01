/**
 * Loading skeleton for the Pay Head Setup page.
 *
 * Mirrors the final layout: hero with title + New button, 4
 * KPI cards, search + filter row, big table card, and the
 * "How pay heads work" info card. Pure presentational — no
 * data.
 */
export default function PayHeadsLoading() {
  return (
    <div className="mx-auto max-w-350 animate-pulse space-y-6 p-6">
      {/* Hero skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded bg-payroll-border/80" />
          <div className="h-4 w-180 max-w-full rounded bg-payroll-border/40" />
        </div>
        <div className="h-9 w-40 rounded-lg bg-payroll-border/80" />
      </div>

      {/* KPI cards skeleton (4 cards) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-payroll-border bg-white p-5"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-payroll-border/80" />
              <div className="space-y-1.5">
                <div className="h-3 w-20 rounded bg-payroll-border/60" />
                <div className="h-5 w-12 rounded bg-payroll-border/80" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filter row skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-9 w-full max-w-md rounded-lg bg-payroll-border/60" />
        <div className="flex gap-1 rounded-lg border border-payroll-border bg-white p-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-7 w-20 rounded-md bg-payroll-border/60" />
          ))}
        </div>
      </div>

      {/* Table card skeleton */}
      <div className="overflow-hidden rounded-xl border border-payroll-border bg-white">
        <div className="border-b border-payroll-border bg-payroll-cream px-5 py-3">
          <div className="grid grid-cols-9 gap-4">
            <div className="h-3 w-12 rounded bg-payroll-border/80" />
            <div className="h-3 w-16 rounded bg-payroll-border/80" />
            <div className="h-3 w-12 rounded bg-payroll-border/80" />
            <div className="h-3 w-8 rounded bg-payroll-border/80" />
            <div className="h-3 w-20 rounded bg-payroll-border/80" />
            <div className="h-3 w-8 rounded bg-payroll-border/80" />
            <div className="h-3 w-16 rounded bg-payroll-border/80" />
            <div className="h-3 w-16 rounded bg-payroll-border/80" />
            <div className="h-3 w-12 justify-self-end rounded bg-payroll-border/80" />
          </div>
        </div>
        <div className="divide-y divide-payroll-border">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="grid grid-cols-9 items-center gap-4 px-5 py-5"
            >
              <div className="h-3.5 w-14 self-center rounded bg-payroll-border/60" />
              <div className="h-3.5 w-24 self-center rounded bg-payroll-border/60" />
              <div className="h-5 w-16 self-center rounded-full bg-payroll-border/60" />
              <div className="h-5 w-8 self-center rounded-full bg-payroll-border/60" />
              <div className="h-3.5 w-20 self-center rounded bg-payroll-border/60" />
              <div className="h-3.5 w-10 self-center rounded bg-payroll-border/60" />
              <div className="flex gap-1 self-center">
                <div className="h-5 w-7 rounded bg-payroll-border/60" />
                <div className="h-5 w-7 rounded bg-payroll-border/60" />
              </div>
              <div className="h-3.5 w-16 self-center rounded bg-payroll-border/60" />
              <div className="flex justify-end gap-1 self-center">
                <div className="h-7 w-7 rounded bg-payroll-border/60" />
                <div className="h-7 w-7 rounded bg-payroll-border/60" />
                <div className="h-7 w-7 rounded bg-payroll-border/60" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info card skeleton */}
      <div className="rounded-xl border border-payroll-border bg-white p-5">
        <div className="flex gap-3">
          <div className="h-5 w-5 shrink-0 rounded-full bg-payroll-border/80" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-payroll-border/80" />
            <div className="h-3 w-full max-w-3xl rounded bg-payroll-border/40" />
            <div className="h-3 w-5/6 max-w-3xl rounded bg-payroll-border/40" />
            <div className="h-3 w-4/6 max-w-3xl rounded bg-payroll-border/40" />
          </div>
        </div>
      </div>
    </div>
  );
}
