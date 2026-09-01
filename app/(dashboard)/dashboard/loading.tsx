export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-[1400px] animate-pulse space-y-6 p-6">
      <div className="h-16 rounded-xl bg-payroll-light" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-payroll-light" />
        ))}
      </div>
      <div className="h-96 rounded-xl bg-payroll-light" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-72 rounded-xl bg-payroll-light lg:col-span-2" />
        <div className="h-72 rounded-xl bg-payroll-light" />
      </div>
    </div>
  );
}
