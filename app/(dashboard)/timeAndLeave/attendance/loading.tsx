export default function AttendanceLoading() {
  return (
    <div className="mx-auto max-w-350 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded bg-[#d7e8d0]/60" />
          <div className="h-4 w-96 rounded bg-[#d7e8d0]/40" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-36 rounded-lg bg-[#d7e8d0]/60" />
          <div className="h-9 w-36 rounded-lg bg-[#d7e8d0]/60" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-[#d7e8d0] bg-white p-4" />
        ))}
      </div>
      <div className="h-96 rounded-xl border border-[#d7e8d0] bg-white p-6" />
    </div>
  );
}