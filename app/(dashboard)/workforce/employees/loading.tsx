export default function EmployeeLoading() {
  return (
    <div className="mx-auto max-w-350 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded bg-[#d7e8d0]/60" />
          <div className="h-4 w-64 rounded bg-[#d7e8d0]/40" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-[#d7e8d0]/60" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-[#d7e8d0]/40" />
        ))}
      </div>
      <div className="h-12 w-full rounded-lg bg-[#d7e8d0]/40" />
      <div className="h-96 w-full rounded-xl bg-[#d7e8d0]/40" />
    </div>
  );
}
