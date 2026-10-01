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
      className={`inline-flex items-center gap-1 rounded-xl bg-slate-100/80 p-1 border border-slate-200/80 ${className}`}
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
            className={`flex items-center gap-1.5 rounded-lg transition-all text-xs font-semibold px-3 cursor-pointer ${
              size === "sm" ? "py-1 text-[11px]" : "py-1.5"
            } ${
              isActive
                ? "bg-payroll-primary text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] tabular-nums font-semibold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-700"
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
