"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled Application Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold text-[#112D4E]">Something went wrong</h2>
      <p className="mt-2 max-w-md text-sm text-gray-600">
        {error?.message || "An unexpected error occurred while processing your request."}
      </p>
      {error.digest && (
        <p className="mt-1 font-mono text-xs text-gray-400">Error Digest: {error.digest}</p>
      )}
      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <Button
          onClick={() => reset()}
          className="flex items-center gap-2 bg-[#19960e] hover:bg-[#157e0c] text-white"
        >
          <RefreshCw className="h-4 w-4" /> Try Again
        </Button>
        <a
          href="/platform/login"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-all"
        >
          Go to Login
        </a>
      </div>
    </div>
  );
}
