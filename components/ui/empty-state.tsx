"use client";

import React, { ReactNode } from "react";
import { FileQuestion } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-payroll-light bg-payroll-cream p-8 text-center ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-payroll-light/50 text-payroll-primary mb-3">
        {icon || <FileQuestion className="h-6 w-6" />}
      </div>
      <h3 className="text-sm font-bold text-payroll-navy">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-gray-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
