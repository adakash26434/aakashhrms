export default function LeaveRulesLoading() {
  return (
    <div className="mx-auto max-w-350 space-y-6 p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded bg-gray-200" />
          <div className="h-4 w-64 rounded bg-gray-200" />
        </div>
        <div className="h-10 w-32 rounded bg-gray-200" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-gray-100 p-4" />
        ))}
      </div>

      <div className="h-96 rounded-xl bg-gray-100" />
    </div>
  );
}
