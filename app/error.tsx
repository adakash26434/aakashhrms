"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isChunkError, setIsChunkError] = useState(false);

  useEffect(() => {
    console.error("Unhandled Application Error:", error);
    const isChunk =
      error?.name === "ChunkLoadError" ||
      /Loading chunk|Failed to load chunk|reading 'call'/i.test(error?.message || "");

    setIsChunkError(isChunk);

    // Auto-reload once if a chunk failed to load (common after fresh deployment)
    if (isChunk && typeof window !== "undefined") {
      const hasRetried = sessionStorage.getItem("chunk_reload_retry");
      if (!hasRetried) {
        sessionStorage.setItem("chunk_reload_retry", "true");
        window.location.reload();
      }
    }
  }, [error]);

  const handleHardReload = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("chunk_reload_retry");
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold text-[#112D4E]">
        {isChunkError ? "Application Update Detected" : "Something went wrong"}
      </h2>
      <p className="mt-2 max-w-md text-sm text-gray-600">
        {isChunkError
          ? "A new version of AakashHRMS was deployed. Please reload the page to load the latest updates."
          : error?.message || "An unexpected error occurred while processing your request."}
      </p>
      {error.digest && (
        <p className="mt-1 font-mono text-xs text-gray-400">Error Digest: {error.digest}</p>
      )}
      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <Button
          onClick={handleHardReload}
          className="flex items-center gap-2 bg-[#19960e] hover:bg-[#157e0c] text-white"
        >
          <RotateCcw className="h-4 w-4" /> Reload Page
        </Button>
        <Button
          onClick={() => reset()}
          variant="outline"
          className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" /> Try Again
        </Button>
        <a
          href="/login"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-all"
        >
          Go to Login
        </a>
      </div>
    </div>
  );
}
