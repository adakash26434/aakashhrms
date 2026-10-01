export default function SystemControlLoading() {
  return (
    <div className="mx-auto max-w-350 animate-pulse space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded bg-payroll-border/80" />
          <div className="h-4 w-md max-w-full rounded bg-payroll-border/40" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-payroll-border/80" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-72 rounded-xl bg-payroll-border/40" />
        <div className="h-72 rounded-xl bg-payroll-border/40" />
      </div>

      <div className="h-44 rounded-xl bg-payroll-border/40" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-80 rounded-xl bg-payroll-border/40" />
        <div className="h-80 rounded-xl bg-payroll-border/40" />
      </div>
    </div>
  );
}
