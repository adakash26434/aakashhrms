"use client";

import React, { ReactNode } from "react";
import { X } from "lucide-react";

interface FilterChipProps {
  label: string;
  value: string;
  onRemove?: () => void;
  icon?: ReactNode;
}

export function FilterChip({ label, value, onRemove, icon }: FilterChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-payroll-light bg-payroll-light/60 px-2.5 py-1 text-xs font-semibold text-payroll-navy transition-all">
      {icon && <span className="text-payroll-primary">{icon}</span>}
      <span className="text-gray-500 font-normal">{label}:</span>
      <span>{value}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded p-0.5 text-gray-500 hover:bg-payroll-light hover:text-payroll-navy transition-colors"
          aria-label={`Remove filter for ${label}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
