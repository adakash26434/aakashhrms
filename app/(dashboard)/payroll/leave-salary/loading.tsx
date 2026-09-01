export default function LeaveSalaryLoading() {
  return (
    <div className="mx-auto max-w-[1400px] animate-pulse space-y-6 p-6">
      <div className="h-16 rounded-xl bg-payroll-light" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-payroll-light" />
        ))}
      </div>
      <div className="h-96 rounded-xl bg-payroll-light" />
    </div>
  );
}
