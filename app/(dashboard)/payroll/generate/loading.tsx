export default function PayrollGenerateLoading() {
  return (
    <div className="mx-auto max-w-[1400px] animate-pulse space-y-6 p-6">
      <div className="h-16 rounded-xl bg-payroll-light" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="h-80 rounded-xl bg-payroll-light" />
        <div className="h-80 rounded-xl bg-payroll-light lg:col-span-2" />
      </div>
      <div className="h-64 rounded-xl bg-payroll-light" />
    </div>
  );
}
