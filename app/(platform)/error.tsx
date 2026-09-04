"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, LogIn } from "lucide-react";
import Link from "next/link";

export default function PlatformErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Platform Control Plane Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold text-payroll-navy">Super Admin Session Notice</h2>
      <p className="mt-2 max-w-md text-sm text-gray-600">
        {error?.message || "An unexpected error occurred in the Control Plane."}
      </p>
      {error?.digest && (
        <p className="mt-1 font-mono text-xs text-gray-400">Error Digest: {error.digest}</p>
      )}
      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <Button
          onClick={() => reset()}
          className="flex items-center gap-2 bg-payroll-primary hover:bg-payroll-primary-hover text-white text-xs font-bold"
        >
          <RefreshCw className="h-4 w-4" /> Try Again
        </Button>
        <Link href="/platform/login">
          <Button
            variant="outline"
            className="flex items-center gap-2 text-xs font-bold"
          >
            <LogIn className="h-4 w-4" /> Re-login to Super Admin
          </Button>
        </Link>
      </div>
    </div>
  );
}
