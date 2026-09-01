export default function OtRulesLoading() {
  return (
    <div className="mx-auto max-w-350 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded bg-[#d7e8d0]/60" />
          <div className="h-4 w-64 rounded bg-[#d7e8d0]/40" />
        </div>
      </div>
      <div className="h-10 w-72 rounded-xl bg-[#f6faf6] p-1.5">
        <div className="flex gap-2">
          <div className="h-8 w-32 rounded-lg bg-[#d7e8d0]/60" />
          <div className="h-8 w-32 rounded-lg bg-[#d7e8d0]/40" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-[#d7e8d0]/40" />
        ))}
      </div>
      <div className="h-96 w-full rounded-xl bg-[#d7e8d0]/40" />
    </div>
  );
}