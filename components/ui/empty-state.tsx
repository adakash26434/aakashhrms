"use client";

import React, { ReactNode } from "react";
import { FileQuestion } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-payroll-light/90 bg-payroll-cream/50 text-center animate-[fadeIn_200ms_ease-out]",
        compact ? "p-6" : "p-10",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl bg-white border border-payroll-light/80 text-payroll-primary shadow-payroll-xs mb-3 transition-transform hover:scale-105",
          compact ? "h-10 w-10" : "h-13 w-13",
        )}
      >
        {icon || (
          <FileQuestion className={compact ? "h-5 w-5" : "h-6.5 w-6.5"} />
        )}
      </div>
      <h3 className="text-sm font-bold text-payroll-navy tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs text-gray-500 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
