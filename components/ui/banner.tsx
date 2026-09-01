"use client";

import { useEffect } from "react";
import { CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type BannerTone = "success" | "info";

interface BannerProps {
  /** Whether the banner is shown. */
  visible: boolean;
  /** The message to display. */
  message: string;
  /** Visual tone (success = green, info = neutral blue). */
  tone?: BannerTone;
  /**
   * Auto-dismiss the banner after this many ms. Pass 0 to disable
   * auto-dismiss (the user must click the X to close).
   * Defaults to 4000ms.
   */
  autoDismissMs?: number;
  /**
   * Called when the banner auto-dismisses or the user clicks X.
   * Use this to clear the underlying `visible` state.
   */
  onDismiss: () => void;
  /** Optional className passthrough for the panel. */
  className?: string;
}

/**
 * Reusable dismissable banner with two tones: success (emerald) and
 * info (neutral blue). When `visible` is true, the banner mounts and
 * (by default) auto-dismisses after 4 seconds. Clicking the X
 * dismisses immediately.
 *
 * This is the extracted version of the banner JSX that previously
 * lived inline in `fiscal-year-client.tsx` and `tax-rate-client.tsx`.
 * Once extracted, both callers (and future pages) share a single
 * source of truth for the design tokens.
 */
export function Banner({
  visible,
  message,
  tone = "success",
  autoDismissMs = 4000,
  onDismiss,
  className,
}: BannerProps) {
  useEffect(() => {
    if (!visible || autoDismissMs <= 0) return;
    const t = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(t);
  }, [visible, autoDismissMs, onDismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm",
        tone === "info"
          ? "border-payroll-light bg-payroll-cream text-payroll-navy"
          : "border-emerald-200 bg-emerald-50 text-emerald-700",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {tone === "info" ? (
          <Info className="h-4 w-4 text-payroll-primary" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        <span>{message}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className={cn(
          "rounded-md p-1 transition-colors",
          tone === "info"
            ? "text-gray-500 hover:bg-payroll-light/60 hover:text-payroll-navy"
            : "text-emerald-700/70 hover:bg-emerald-100 hover:text-emerald-800",
        )}
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
