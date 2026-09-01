"use client";

import React from "react";

export interface SegmentOption<T extends string = string> {
  id: T;
  label: string;
  count?: number;
}

interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
  size?: "sm" | "md";
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className = "",
  size = "md",
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-xl bg-[#f6faf6] p-1 border border-[#d7e8d0] ${className}`}
      role="tablist"
    >
      {options.map((opt) => {
        const isActive = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.id)}
            className={`flex items-center gap-1.5 rounded-lg transition-all text-xs font-bold px-3 ${
              size === "sm" ? "py-1 text-[11px]" : "py-1.5"
            } ${
              isActive
                ? "bg-white text-[#1b3a1f] shadow-payroll-sm border border-[#d7e8d0]"
                : "text-gray-500 hover:text-[#1b3a1f] border border-transparent"
            }`}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] tabular-nums font-semibold ${
                  isActive
                    ? "bg-[#2e7d32]/10 text-[#2e7d32]"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
