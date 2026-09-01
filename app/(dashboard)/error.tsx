"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Lock } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DASHBOARD_ERROR]", error);
  }, [error]);

  const isPermissionError =
    error.message?.includes("Unauthorized") ||
    error.message?.includes("Required permission") ||
    error.message?.includes("missing");

  if (isPermissionError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50 border border-red-100 mb-6">
          <Lock className="h-9 w-9 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Access Denied
        </h1>
        <p className="text-sm text-gray-500 max-w-md mb-1">
          You don&apos;t have permission to access this module.
        </p>
        <p className="text-xs text-gray-400 max-w-md mb-6">
          Contact your administrator to request the required role permissions.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-[#1b3a1f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#2a5a2f] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Dashboard
          </Link>
        </div>
        <div className="mt-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-700 max-w-md">
          <strong>Missing Permission:</strong>{" "}
          {error.message.replace("Unauthorized: ", "").replace("Error: ", "")}
        </div>
      </div>
    );
  }

  // Generic error fallback
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-50 border border-amber-100 mb-6">
        <ShieldAlert className="h-9 w-9 text-amber-500" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Something went wrong
      </h1>
      <p className="text-sm text-gray-500 max-w-md mb-6">
        An unexpected error occurred. Please try again or return to the
        dashboard.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          Try Again
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-[#1b3a1f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#2a5a2f] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
