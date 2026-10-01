export default function FiscalYearLoading() {
  return (
    <div className="mx-auto max-w-350 animate-pulse space-y-6 p-6">
      {/* Hero skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded bg-payroll-border/80" />
          <div className="h-4 w-md max-w-full rounded bg-payroll-border/40" />
        </div>
        <div className="h-9 w-40 rounded-lg bg-payroll-border/80" />
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-payroll-border bg-white">
        <div className="border-b border-payroll-border bg-payroll-cream px-5 py-3">
          <div className="grid grid-cols-6 gap-4">
            <div className="h-3 w-8 rounded bg-payroll-border/80" />
            <div className="h-3 w-16 rounded bg-payroll-border/80" />
            <div className="h-3 w-12 rounded bg-payroll-border/80" />
            <div className="h-3 w-20 rounded bg-payroll-border/80" />
            <div className="h-3 w-12 rounded bg-payroll-border/80" />
            <div className="h-3 w-12 justify-self-end rounded bg-payroll-border/80" />
          </div>
        </div>
        <div className="divide-y divide-payroll-border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid grid-cols-6 gap-4 px-5 py-5">
              <div className="space-y-1.5">
                <div className="h-3.5 w-24 rounded bg-payroll-border/80" />
                <div className="h-3 w-20 rounded bg-payroll-border/40" />
              </div>
              <div className="h-3.5 w-16 self-center rounded bg-payroll-border/60" />
              <div className="h-3.5 w-12 self-center rounded bg-payroll-border/60" />
              <div className="h-3.5 w-40 self-center rounded bg-payroll-border/60" />
              <div className="h-5 w-16 self-center rounded bg-payroll-border/60" />
              <div className="flex justify-end gap-1 self-center">
                <div className="h-7 w-7 rounded bg-payroll-border/60" />
                <div className="h-7 w-7 rounded bg-payroll-border/60" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
