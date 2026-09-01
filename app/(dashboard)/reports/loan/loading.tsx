export default function LoanReportLoading() {
  return (
    <div className="flex h-96 items-center justify-center rounded-xl border border-gray-200/80 bg-white">
      <div className="flex items-center space-x-3 text-gray-500">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
        <span className="text-sm font-semibold">Loading Loan Report...</span>
      </div>
    </div>
  );
}
