"use client";

import React, { ReactNode } from "react";

interface ReportDataTableShellProps {
  children: ReactNode;
  maxHeightClass?: string;
  className?: string;
}

export function ReportDataTableShell({
  children,
  maxHeightClass = "max-h-[min(70vh,720px)]",
  className = "",
}: ReportDataTableShellProps) {
  return (
    <div
      className={`overflow-x-auto rounded-xl border border-[#d7e8d0] bg-white shadow-payroll-sm ${maxHeightClass} overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:border-none ${className}`}
    >
      {children}
    </div>
  );
}
