"use client";

import { cn } from "@/lib/utils";
import type { TaxCategory } from "@/lib/types/tax-rate";
import { TAX_CATEGORIES } from "@/lib/types/tax-rate";

interface TaxRateTabsProps {
  /** The currently active category. */
  active: TaxCategory;
  /** Called when the user picks a different tab. */
  onChange: (next: TaxCategory) => void;
  /**
   * Optional: a map of category → "configured" indicator.
   */
  configuredMap?: Partial<Record<TaxCategory, boolean>>;
}

/**
 * 3-tab category selector: Normal Single / Married / Handicapped.
 */
export function TaxRateTabs({ active, onChange, configuredMap }: TaxRateTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Tax category"
      className="inline-flex w-full gap-1 rounded-lg border border-slate-200/80 bg-slate-100/70 p-1 sm:w-auto"
    >
      {TAX_CATEGORIES.map((category) => {
        const isActive = category === active;
        const isConfigured = configuredMap?.[category] ?? false;
        return (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(category)}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-1.5 text-xs transition-all cursor-pointer select-none",
              isActive
                ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50 font-medium",
            )}
          >
            <span>{category}</span>
            {isConfigured && (
              <span
                aria-hidden
                title="This category has configured slabs"
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isActive ? "bg-emerald-800" : "bg-emerald-600",
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
