"use client";

import React, { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type BannerVariant = "error" | "warning" | "info" | "success";

export interface ErrorBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BannerVariant;
  title?: string;
  message: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
}

export function ErrorBanner({
  variant = "error",
  title,
  message,
  action,
  onDismiss,
  className,
  ...props
}: ErrorBannerProps) {
  const variantStyles = {
    error: {
      container: "bg-rose-50 border-rose-200 text-rose-900",
      icon: <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />,
      titleColor: "text-rose-950",
      dismiss: "text-rose-500 hover:bg-rose-100 hover:text-rose-700",
    },
    warning: {
      container: "bg-amber-50 border-amber-200 text-amber-900",
      icon: <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />,
      titleColor: "text-amber-950",
      dismiss: "text-amber-500 hover:bg-amber-100 hover:text-amber-700",
    },
    info: {
      container: "bg-sky-50 border-sky-200 text-sky-900",
      icon: <Info className="h-4 w-4 text-sky-600 shrink-0" />,
      titleColor: "text-sky-950",
      dismiss: "text-sky-500 hover:bg-sky-100 hover:text-sky-700",
    },
    success: {
      container: "bg-emerald-50 border-emerald-200 text-emerald-900",
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />,
      titleColor: "text-emerald-950",
      dismiss: "text-emerald-500 hover:bg-emerald-100 hover:text-emerald-700",
    },
  };

  const style = variantStyles[variant];

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border p-3.5 text-xs shadow-2xs animate-[fadeIn_150ms_ease-out]",
        style.container,
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="mt-0.5">{style.icon}</div>
        <div className="min-w-0 flex-1">
          {title && (
            <h5 className={cn("font-bold mb-0.5", style.titleColor)}>
              {title}
            </h5>
          )}
          <div className="leading-relaxed text-xs">{message}</div>
          {action && <div className="mt-2">{action}</div>}
        </div>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className={cn(
            "rounded-lg p-1 transition-colors cursor-pointer shrink-0 -mr-1 -mt-1",
            style.dismiss,
          )}
          aria-label="Dismiss alert"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
