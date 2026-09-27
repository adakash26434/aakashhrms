export default function ReportsLoading() {
  return (
    <div className="mx-auto max-w-350 animate-pulse space-y-6 p-6">
      <div className="h-16 rounded-lg bg-zinc-100" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 rounded-lg bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}
