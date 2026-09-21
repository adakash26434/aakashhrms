import React from "react";
import { cn } from "@/lib/utils";

export interface LoadingBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "spinner" | "skeleton" | "card";
  rows?: number;
  message?: string;
  height?: string | number;
}

export function LoadingBlock({
  variant = "skeleton",
  rows = 3,
  message,
  height,
  className,
  style,
  ...props
}: LoadingBlockProps) {
  if (variant === "spinner") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-8 text-center",
          className,
        )}
        style={{ minHeight: height, ...style }}
        {...props}
      >
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-payroll-primary border-t-transparent mb-2" />
        {message && (
          <p className="text-xs font-medium text-gray-500">{message}</p>
        )}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={cn(
          "rounded-2xl border border-payroll-light/80 bg-white p-5 shadow-payroll-xs animate-pulse space-y-4",
          className,
        )}
        style={{ minHeight: height, ...style }}
        {...props}
      >
        <div className="h-5 w-1/3 rounded-lg bg-gray-200" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded-md bg-gray-100" />
          <div className="h-4 w-5/6 rounded-md bg-gray-100" />
          <div className="h-4 w-2/3 rounded-md bg-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("w-full space-y-3 p-4 animate-pulse", className)}
      style={{ minHeight: height, ...style }}
      {...props}
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-4 rounded-md bg-gray-200/80"
          style={{ width: `${Math.max(40, 100 - index * 15)}%` }}
        />
      ))}
      {message && (
        <p className="pt-1 text-xs text-gray-400 text-center">{message}</p>
      )}
    </div>
  );
}
