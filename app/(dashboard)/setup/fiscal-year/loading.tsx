export default function FiscalYearLoading() {
  return (
    <div className="mx-auto max-w-350 animate-pulse space-y-6 p-6">
      {/* Hero skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded bg-[#d7e8d0]/60" />
          <div className="h-4 w-md max-w-full rounded bg-[#d7e8d0]/40" />
        </div>
        <div className="h-9 w-40 rounded-lg bg-[#d7e8d0]/60" />
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-[#d7e8d0]/80 bg-white">
        <div className="border-b border-[#d7e8d0]/80 bg-[#f6faf6]/60 px-5 py-3">
          <div className="grid grid-cols-6 gap-4">
            <div className="h-3 w-8 rounded bg-[#d7e8d0]/60" />
            <div className="h-3 w-16 rounded bg-[#d7e8d0]/60" />
            <div className="h-3 w-12 rounded bg-[#d7e8d0]/60" />
            <div className="h-3 w-20 rounded bg-[#d7e8d0]/60" />
            <div className="h-3 w-12 rounded bg-[#d7e8d0]/60" />
            <div className="h-3 w-12 justify-self-end rounded bg-[#d7e8d0]/60" />
          </div>
        </div>
        <div className="divide-y divide-[#d7e8d0]/60">
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid grid-cols-6 gap-4 px-5 py-5">
              <div className="space-y-1.5">
                <div className="h-3.5 w-24 rounded bg-[#d7e8d0]/60" />
                <div className="h-3 w-20 rounded bg-[#d7e8d0]/40" />
              </div>
              <div className="h-3.5 w-16 self-center rounded bg-[#d7e8d0]/50" />
              <div className="h-3.5 w-12 self-center rounded bg-[#d7e8d0]/50" />
              <div className="h-3.5 w-40 self-center rounded bg-[#d7e8d0]/50" />
              <div className="h-5 w-16 self-center rounded bg-[#d7e8d0]/50" />
              <div className="flex justify-end gap-1 self-center">
                <div className="h-7 w-7 rounded bg-[#d7e8d0]/50" />
                <div className="h-7 w-7 rounded bg-[#d7e8d0]/50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
